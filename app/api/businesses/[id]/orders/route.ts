import { NextResponse } from "next/server";
import {
  getOrderAdmin,
  cleanPhone,
  moneyCents,
} from "@/lib/restaurant-order/server";
import { createStripeCheckoutSession } from "@/lib/restaurant-order/stripe";
import { sendTwilioSms } from "@/lib/restaurant-order/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestItem = {
  menuItemId: number;
  quantity: number;
  instructions?: string;
  selections?: unknown;
};

function orderNumber() {
  return `${Date.now()
    .toString()
    .slice(-7)}${Math.floor(Math.random() * 90 + 10)}`;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);

    if (!Number.isInteger(businessId) || businessId <= 0) {
      return NextResponse.json(
        { error: "Invalid business ID." },
        { status: 400 },
      );
    }

    const body = await request.json();

    const fulfillmentType =
      body?.fulfillmentType === "delivery"
        ? "delivery"
        : "pickup";

    const paymentMethod =
      body?.paymentMethod === "pay_at_pickup"
        ? "pay_at_pickup"
        : "online";

    const customerName = String(
      body?.customer?.name || "",
    )
      .trim()
      .slice(0, 120);

    const customerPhone = cleanPhone(
      body?.customer?.phone,
    );

    const items: RequestItem[] = Array.isArray(
      body?.items,
    )
      ? body.items
      : [];

    if (!customerName || !customerPhone) {
      return NextResponse.json(
        {
          error:
            "Name and phone number are required.",
        },
        { status: 400 },
      );
    }

    if (!items.length) {
      return NextResponse.json(
        { error: "Your cart is empty." },
        { status: 400 },
      );
    }

    if (fulfillmentType === "delivery") {
      const address =
        body?.deliveryAddress || {};

      if (
        !address.address1 ||
        !address.city ||
        !address.state ||
        !address.postalCode
      ) {
        return NextResponse.json(
          {
            error:
              "A complete delivery address is required.",
          },
          { status: 400 },
        );
      }
    }

    const db = getOrderAdmin();

    const [
      { data: business },
      { data: settings },
      { data: privateSettings },
    ] = await Promise.all([
      db
        .from("businesses")
        .select("id,name")
        .eq("id", businessId)
        .single(),

      db
        .from("restaurant_order_settings")
        .select(
          "pickup_enabled,delivery_enabled,pay_at_pickup_enabled,sms_enabled,tax_rate,pickup_prep_minutes,delivery_prep_minutes",
        )
        .eq("business_id", businessId)
        .maybeSingle(),

      db
        .from(
          "restaurant_order_private_settings",
        )
        .select(
          "payment_provider,stripe_secret_key,square_access_token,square_location_id,twilio_account_sid,twilio_auth_token,twilio_phone_number",
        )
        .eq("business_id", businessId)
        .maybeSingle(),
    ]);

    if (
      fulfillmentType === "pickup" &&
      settings?.pickup_enabled === false
    ) {
      return NextResponse.json(
        {
          error:
            "Pickup ordering is currently unavailable.",
        },
        { status: 400 },
      );
    }

    if (
      fulfillmentType === "delivery" &&
      settings?.delivery_enabled !== true
    ) {
      return NextResponse.json(
        {
          error:
            "Delivery ordering is currently unavailable.",
        },
        { status: 400 },
      );
    }

    if (
      paymentMethod === "pay_at_pickup" &&
      (
        fulfillmentType !== "pickup" ||
        settings?.pay_at_pickup_enabled === false
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Pay at Store is not available for this order.",
        },
        { status: 400 },
      );
    }

    const paymentProvider =
      privateSettings?.payment_provider === "square"
        ? "square"
        : "stripe";

    const stripeSecretKey =
      privateSettings?.stripe_secret_key || "";

    const squareAccessToken =
      privateSettings?.square_access_token || "";

    const squareLocationId =
      privateSettings?.square_location_id || "";

    if (paymentMethod === "online") {
      if (
        paymentProvider === "square" &&
        (!squareAccessToken || !squareLocationId)
      ) {
        return NextResponse.json(
          {
            error:
              "Square is selected, but this restaurant has not connected its Square account yet.",
          },
          { status: 400 },
        );
      }

      if (
        paymentProvider === "stripe" &&
        !stripeSecretKey
      ) {
        return NextResponse.json(
          {
            error:
              "Stripe is selected, but Stripe payment has not been configured yet.",
          },
          { status: 400 },
        );
      }
    }

    const ids = [
      ...new Set(
        items
          .map((item) =>
            Number(item.menuItemId),
          )
          .filter(
            (menuItemId) =>
              Number.isInteger(menuItemId) &&
              menuItemId > 0,
          ),
      ),
    ];

    if (!ids.length) {
      return NextResponse.json(
        {
          error:
            "Your cart does not contain any valid menu items.",
        },
        { status: 400 },
      );
    }

    const {
      data: menuRows,
      error: menuError,
    } = await db
      .from("business_menu_items")
      .select(
        "id,name,price,pickup_price,delivery_price,is_available",
      )
      .eq("business_id", businessId)
      .in("id", ids);

    if (menuError) {
      throw menuError;
    }

    const menuMap = new Map(
      (menuRows || []).map((row) => [
        Number(row.id),
        row,
      ]),
    );

    const normalized = items.map(
      (item) => {
        const row: any = menuMap.get(
          Number(item.menuItemId),
        );

        if (
          !row ||
          row.is_available === false
        ) {
          throw new Error(
            "Your order contains an unavailable menu item.",
          );
        }

        const quantity = Math.min(
          99,
          Math.max(
            1,
            Number(item.quantity) || 1,
          ),
        );

        const base = Number(
          row.price || 0,
        );

        const pickup =
          row.pickup_price == null
            ? base
            : Number(
                row.pickup_price,
              );

        const delivery =
          row.delivery_price == null
            ? pickup
            : Number(
                row.delivery_price,
              );

        const unitPrice =
          fulfillmentType === "delivery"
            ? delivery
            : pickup;

        return {
          menuItemId: Number(row.id),
          name: String(row.name),
          quantity,
          unitPrice,
          lineTotal:
            unitPrice * quantity,
          instructions: String(
            item.instructions || "",
          ).slice(0, 500),
          selections:
            item.selections ?? null,
        };
      },
    );

    const subtotal =
      normalized.reduce(
        (sum, item) =>
          sum + item.lineTotal,
        0,
      );

    const taxRate = Math.max(
      0,
      Number(settings?.tax_rate || 0),
    );

    const tax =
      subtotal * taxRate;

    const tipPercent =
      Math.max(
        0,
        Math.min(
          100,
          Number(
            body?.tipPercent || 0,
          ),
        ),
      );

    const tip =
      subtotal *
      (tipPercent / 100);

    const total =
      subtotal + tax + tip;

    const number =
      orderNumber();

    const address =
      fulfillmentType === "delivery"
        ? body.deliveryAddress
        : null;

    const {
      data: order,
      error: orderError,
    } = await db
      .from("restaurant_orders")
      .insert({
        business_id:
          businessId,
        order_number:
          number,
        fulfillment_type:
          fulfillmentType,
        customer_name:
          customerName,
        customer_phone:
          customerPhone,
        delivery_address:
          address,
        requested_time: String(
          body?.requestedTime ||
            "asap",
        ).slice(0, 80),
        payment_method:
          paymentMethod,
        payment_status:
          paymentMethod ===
          "pay_at_pickup"
            ? "pay_at_pickup"
            : "pending",
        order_status:
          "new",
        subtotal,
        tax,
        tip,
        total,
      })
      .select("id")
      .single();

    if (orderError) {
      throw orderError;
    }

    const {
      error: itemsError,
    } = await db
      .from(
        "restaurant_order_items",
      )
      .insert(
        normalized.map(
          (item) => ({
            order_id:
              order.id,
            business_id:
              businessId,
            menu_item_id:
              item.menuItemId,
            item_name:
              item.name,
            quantity:
              item.quantity,
            unit_price:
              item.unitPrice,
            line_total:
              item.lineTotal,
            instructions:
              item.instructions,
            selections:
              item.selections,
          }),
        ),
      );

    if (itemsError) {
      throw itemsError;
    }

    if (
      paymentMethod === "online"
    ) {
      const origin =
        new URL(
          request.url,
        ).origin;

      if (paymentProvider === "square") {
        const squareApplicationId =
          process.env.SQUARE_APPLICATION_ID || "";

        if (!squareApplicationId) {
          throw new Error(
            "SQUARE_APPLICATION_ID is not configured.",
          );
        }

        const squareOrderResponse = await fetch(
          "https://connect.squareup.com/v2/orders",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${squareAccessToken}`,
              "Content-Type": "application/json",
              "Square-Version": "2026-08-19",
            },
            body: JSON.stringify({
              idempotency_key: `ktown-order-${order.id}`,
              order: {
                location_id: squareLocationId,
                reference_id: `KTOWN-${number}`,
                source: {
                  name: "KTown Triangle",
                },
                line_items: [
                  ...normalized.map((item) => {
                    const selectionText =
                      item.selections == null
                        ? ""
                        : typeof item.selections === "string"
                          ? item.selections
                          : JSON.stringify(item.selections);

                    const note = [
                      item.instructions
                        ? `Instructions: ${item.instructions}`
                        : "",
                      selectionText
                        ? `Options: ${selectionText}`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" | ")
                      .slice(0, 500);

                    return {
                      name: item.name,
                      quantity: String(item.quantity),
                      base_price_money: {
                        amount: moneyCents(item.unitPrice),
                        currency: "USD",
                      },
                      ...(note ? { note } : {}),
                    };
                  }),
                  ...(tax > 0
                    ? [
                        {
                          name: "Tax",
                          quantity: "1",
                          base_price_money: {
                            amount: moneyCents(tax),
                            currency: "USD",
                          },
                        },
                      ]
                    : []),
                  ...(tip > 0
                    ? [
                        {
                          name: "Tip",
                          quantity: "1",
                          base_price_money: {
                            amount: moneyCents(tip),
                            currency: "USD",
                          },
                        },
                      ]
                    : []),
                ],
                fulfillments: [
                  fulfillmentType === "pickup"
                    ? {
                        type: "PICKUP",
                        state: "PROPOSED",
                        pickup_details: {
                          schedule_type: "ASAP",
                          prep_time_duration: `PT${Math.max(
                            1,
                            Number(settings?.pickup_prep_minutes || 20),
                          )}M`,
                          recipient: {
                            display_name: customerName,
                            phone_number: customerPhone,
                          },
                          note: `KTown order #${number} · Requested: ${String(
                            body?.requestedTime || "asap",
                          ).slice(0, 80)}`,
                        },
                      }
                    : {
                        type: "DELIVERY",
                        state: "PROPOSED",
                        delivery_details: {
                          schedule_type: "ASAP",
                          prep_time_duration: `PT${Math.max(
                            1,
                            Number(settings?.delivery_prep_minutes || 45),
                          )}M`,
                          recipient: {
                            display_name: customerName,
                            phone_number: customerPhone,
                            address: {
                              address_line_1: String(
                                address?.address1 || "",
                              ).slice(0, 500),
                              ...(address?.address2
                                ? {
                                    address_line_2: String(
                                      address.address2,
                                    ).slice(0, 500),
                                  }
                                : {}),
                              locality: String(
                                address?.city || "",
                              ).slice(0, 255),
                              administrative_district_level_1: String(
                                address?.state || "",
                              )
                                .trim()
                                .toUpperCase()
                                .slice(0, 3),
                              postal_code: String(
                                address?.postalCode || "",
                              ).slice(0, 32),
                              country: "US",
                            },
                          },
                          ...(address?.note
                            ? {
                                dropoff_notes: String(
                                  address.note,
                                ).slice(0, 550),
                              }
                            : {}),
                        },
                      },
                ],
              },
            }),
            cache: "no-store",
          },
        );

        const squareOrderText = await squareOrderResponse.text();

        let squareOrderPayload: any = {};
        try {
          squareOrderPayload = squareOrderText
            ? JSON.parse(squareOrderText)
            : {};
        } catch {
          throw new Error(
            `Square returned an invalid order response (HTTP ${squareOrderResponse.status}).`,
          );
        }

        if (!squareOrderResponse.ok) {
          const detail =
            Array.isArray(squareOrderPayload?.errors) &&
            squareOrderPayload.errors.length
              ? squareOrderPayload.errors
                  .map(
                    (item: any) =>
                      item?.detail ||
                      item?.code ||
                      "Square order error",
                  )
                  .join(" / ")
              : `HTTP ${squareOrderResponse.status}`;

          throw new Error(
            `Square order could not be created: ${detail}`,
          );
        }

        const squareOrderId =
          String(squareOrderPayload?.order?.id || "");

        if (!squareOrderId) {
          throw new Error(
            "Square did not return an order ID.",
          );
        }

        const { error: squareOrderSaveError } = await db
          .from("restaurant_orders")
          .update({
            square_order_id: squareOrderId,
            square_payment_link_id: null,
          })
          .eq("id", order.id);

        if (squareOrderSaveError) {
          throw squareOrderSaveError;
        }

        // Apple Pay on the Web needs the current host registered for this seller.
        // Failure here does not block Card or Google Pay.
        try {
          const host = new URL(request.url).hostname;
          if (
            host &&
            host !== "localhost" &&
            host !== "127.0.0.1"
          ) {
            await fetch(
              "https://connect.squareup.com/v2/apple-pay/domains",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${squareAccessToken}`,
                  "Content-Type": "application/json",
                  "Square-Version": "2026-08-19",
                },
                body: JSON.stringify({
                  domain_name: host,
                }),
                cache: "no-store",
              },
            );
          }
        } catch {
          // Do not fail the order if Apple Pay domain registration is unavailable.
        }

        return NextResponse.json({
          ok: true,
          paymentProvider: "square",
          paymentRequired: true,
          orderId: order.id,
          orderNumber: number,
          squarePayment: {
            applicationId: squareApplicationId,
            locationId: squareLocationId,
            amount: total.toFixed(2),
            amountCents: moneyCents(total),
            currencyCode: "USD",
          },
        });
      }

      const session =
        await createStripeCheckoutSession(
          {
            secretKey:
              stripeSecretKey,
            orderId:
              order.id,
            orderNumber:
              number,
            businessId,
            businessName:
              business?.name ||
              "Restaurant",
            amountCents:
              moneyCents(total),
            customerName,
            customerPhone,
            origin,
          },
        );

      await db
        .from(
          "restaurant_orders",
        )
        .update({
          stripe_session_id:
            session.id,
        })
        .eq(
          "id",
          order.id,
        );

      return NextResponse.json({
        ok: true,
        paymentProvider: "stripe",
        orderId:
          order.id,
        orderNumber:
          number,
        checkoutUrl:
          session.url,
      });
    }

    if (
      settings?.sms_enabled &&
      privateSettings?.twilio_account_sid &&
      privateSettings?.twilio_auth_token &&
      privateSettings?.twilio_phone_number
    ) {
      sendTwilioSms(
        {
          accountSid:
            privateSettings.twilio_account_sid,
          authToken:
            privateSettings.twilio_auth_token,
          fromNumber:
            privateSettings.twilio_phone_number,
        },
        customerPhone,
        `${
          business?.name ||
          "Restaurant"
        }: Order #${number} received. ${
          fulfillmentType ===
          "pickup"
            ? "We'll text you when it's ready."
            : "Your delivery order is being prepared."
        }`,
      ).catch(
        (error) =>
          console.error(
            "ORDER SMS ERROR",
            error,
          ),
      );
    }

    return NextResponse.json({
      ok: true,
      orderId:
        order.id,
      orderNumber:
        number,
    });
  } catch (error) {
    console.error(
      "PUBLIC ORDER POST ERROR",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process your order.",
      },
      { status: 500 },
    );
  }
}