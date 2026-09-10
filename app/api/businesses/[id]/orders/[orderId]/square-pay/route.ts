import { createHash, randomBytes, randomUUID } from "crypto";
import { NextResponse } from "next/server";
import {
  getOrderAdmin,
  moneyCents,
} from "@/lib/restaurant-order/server";
import { dispatchUberDirectOrder } from "@/lib/delivery/uber-direct";
import {
  centralTwilioConfig,
  isKtownSmsEnabled,
  sendTwilioSms,
} from "@/lib/restaurant-order/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function squareErrorDetail(payload: any, fallback: string) {
  if (
    Array.isArray(payload?.errors) &&
    payload.errors.length
  ) {
    return payload.errors
      .map(
        (item: any) =>
          item?.detail ||
          item?.code ||
          "Square payment error",
      )
      .join(" / ");
  }
  return fallback;
}

function tokenHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function publicBaseUrl(request: Request) {
  const configured = String(process.env.KTOWN_PUBLIC_URL || "")
    .trim()
    .replace(/\/+$/, "");

  if (configured) return configured;

  return new URL(request.url).origin;
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      id: string;
      orderId: string;
    }>;
  },
) {
  try {
    const { id, orderId } = await context.params;
    const businessId = Number(id);
    const ktownOrderId = Number(orderId);

    if (
      !Number.isInteger(businessId) ||
      businessId <= 0 ||
      !Number.isInteger(ktownOrderId) ||
      ktownOrderId <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid order." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const sourceId = String(body?.sourceId || "").trim();
    const verificationToken = String(
      body?.verificationToken || "",
    ).trim();
    const attemptId = String(
      body?.attemptId || randomUUID(),
    )
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 80);

    if (!sourceId) {
      return NextResponse.json(
        { error: "Payment token is required." },
        { status: 400 },
      );
    }

    const db = getOrderAdmin();

    const [
      { data: order, error: orderError },
      { data: privateSettings, error: privateError },
      { data: business, error: businessError },
    ] = await Promise.all([
      db
        .from("restaurant_orders")
        .select(
          "id,business_id,order_number,total,fulfillment_type,customer_phone,payment_status,square_order_id,square_payment_id,sms_consent,sms_sent_at,cancel_expires_at",
        )
        .eq("id", ktownOrderId)
        .eq("business_id", businessId)
        .single(),

      db
        .from("restaurant_order_private_settings")
        .select(
          "payment_provider,square_access_token,square_location_id,delivery_provider,uber_direct_enabled,uber_direct_customer_id",
        )
        .eq("business_id", businessId)
        .maybeSingle(),

      db
        .from("businesses")
        .select("id,name")
        .eq("id", businessId)
        .maybeSingle(),
    ]);

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 },
      );
    }

    if (privateError) {
      throw privateError;
    }

    if (businessError) {
      throw businessError;
    }

    if (
      privateSettings?.payment_provider !== "square" ||
      !privateSettings?.square_access_token ||
      !privateSettings?.square_location_id
    ) {
      return NextResponse.json(
        {
          error:
            "Square payment is not configured for this restaurant.",
        },
        { status: 400 },
      );
    }

    if (!order.square_order_id) {
      return NextResponse.json(
        {
          error:
            "This order has not been prepared in Square.",
        },
        { status: 400 },
      );
    }

    if (
      order.payment_status === "paid" &&
      order.square_payment_id
    ) {
      return NextResponse.json({
        ok: true,
        alreadyPaid: true,
        paymentStatus: "paid",
        paymentId: order.square_payment_id,
        orderNumber: order.order_number,
      });
    }

    const amountCents = moneyCents(
      Number(order.total || 0),
    );

    if (amountCents <= 0) {
      return NextResponse.json(
        { error: "Invalid payment total." },
        { status: 400 },
      );
    }

    const squareResponse = await fetch(
      "https://connect.squareup.com/v2/payments",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${privateSettings.square_access_token}`,
          "Content-Type": "application/json",
          "Square-Version": "2026-08-19",
        },
        body: JSON.stringify({
          source_id: sourceId,
          idempotency_key:
            `ktown-${ktownOrderId}-${attemptId || randomUUID()}`,
          amount_money: {
            amount: amountCents,
            currency: "USD",
          },
          order_id: order.square_order_id,
          location_id:
            privateSettings.square_location_id,
          autocomplete: true,
          ...(verificationToken
            ? {
                verification_token:
                  verificationToken,
              }
            : {}),
          note: `KTown order #${order.order_number}`,
        }),
        cache: "no-store",
      },
    );

    const squareText = await squareResponse.text();
    let squarePayload: any = {};

    try {
      squarePayload = squareText
        ? JSON.parse(squareText)
        : {};
    } catch {
      throw new Error(
        `Square returned an invalid payment response (HTTP ${squareResponse.status}).`,
      );
    }

    if (!squareResponse.ok) {
      return NextResponse.json(
        {
          error: squareErrorDetail(
            squarePayload,
            `Square payment failed (HTTP ${squareResponse.status}).`,
          ),
        },
        { status: 400 },
      );
    }

    const payment = squarePayload?.payment;
    const paymentId = String(payment?.id || "");
    const status = String(payment?.status || "");

    if (!paymentId) {
      return NextResponse.json(
        {
          error:
            "Square did not return a payment ID.",
        },
        { status: 502 },
      );
    }

    if (status !== "COMPLETED") {
      return NextResponse.json(
        {
          error: `Payment is ${status || "not completed"}.`,
          paymentStatus: status,
        },
        { status: 400 },
      );
    }

    const paidAt = new Date();
    const cancelExpiresAt = new Date(paidAt.getTime() + 3 * 60 * 1000);
    const rawCancelToken = randomBytes(24).toString("base64url");
    const cancelTokenHash = tokenHash(rawCancelToken);

    const { error: updateError } = await db
      .from("restaurant_orders")
      .update({
        payment_status: "paid",
        square_payment_id: paymentId,
        paid_at: paidAt.toISOString(),
        cancel_token_hash: cancelTokenHash,
        cancel_expires_at: cancelExpiresAt.toISOString(),
      })
      .eq("id", ktownOrderId)
      .eq("business_id", businessId);

    if (updateError) {
      throw updateError;
    }

    let delivery: any = null;

    try {
      delivery = await dispatchUberDirectOrder({
        db,
        businessId,
        orderId: ktownOrderId,
      });
    } catch (deliveryError) {
      console.error(
        "Uber Direct automatic dispatch failed:",
        deliveryError,
      );

      // Payment remains successful. The delivery failure is saved on the order
      // and can be retried without charging the customer again.
      delivery = {
        ok: false,
        error:
          deliveryError instanceof Error
            ? deliveryError.message
            : "Courier dispatch failed.",
      };
    }

    let sms: any = null;

    if (
      isKtownSmsEnabled() &&
      order.sms_consent === true &&
      !order.sms_sent_at
    ) {
      const twilio = centralTwilioConfig();

      if (twilio) {
        const cancelUrl =
          `${publicBaseUrl(request)}/c/${encodeURIComponent(rawCancelToken)}`;
        const restaurantName = String(
          business?.name || "Restaurant",
        ).trim();
        const fulfillmentLabel =
          order.fulfillment_type === "delivery" ? "Delivery" : "Pickup";

        const message = [
          `KTown Triangle - ${restaurantName}`,
          `Order #${order.order_number} confirmed.`,
          `${fulfillmentLabel} · Total $${Number(order.total || 0).toFixed(2)}`,
          "",
          "Cancel Order (within 3 minutes):",
          cancelUrl,
          "",
          "Reply STOP to opt out or HELP for help.",
        ].join("\n");

        try {
          sms = await sendTwilioSms(
            twilio,
            String(order.customer_phone || ""),
            message,
          );

          const { error: smsSaveError } = await db
            .from("restaurant_orders")
            .update({
              sms_sent_at: new Date().toISOString(),
              sms_message_sid: sms.sid || null,
            })
            .eq("id", ktownOrderId)
            .eq("business_id", businessId);

          if (smsSaveError) {
            console.error("ORDER SMS SAVE ERROR", smsSaveError);
          }
        } catch (smsError) {
          console.error("ORDER SMS ERROR", smsError);
          // Payment and delivery remain successful even if SMS fails.
          sms = {
            ok: false,
            error:
              smsError instanceof Error
                ? smsError.message
                : "SMS failed.",
          };
        }
      }
    }

    return NextResponse.json({
      ok: true,
      paymentStatus: "paid",
      paymentId,
      orderNumber: order.order_number,
      delivery,
      smsQueued: !!sms && sms?.ok !== false,
      cancelExpiresAt: cancelExpiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Square direct payment error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Payment could not be completed.",
      },
      { status: 500 },
    );
  }
}
