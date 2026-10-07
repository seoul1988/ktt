import { NextResponse } from "next/server";
import { getOrderAdmin } from "@/lib/restaurant-order/server";
import {
  createUberDirectQuote,
  dispatchUberDirectOrder,
  isUberDirectEnabled,
} from "@/lib/delivery/uber-direct";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pickupAddressForDisplay(business: any) {
  const full = String(business?.address || "").trim();
  if (full) return full;

  return [
    business?.address1 || business?.street_address,
    business?.address2,
    business?.city,
    [business?.state, business?.zip || business?.zipcode || business?.postal_code]
      .filter(Boolean)
      .join(" "),
  ]
    .filter(Boolean)
    .join(", ");
}

function dropoffAddressForDisplay(address: any) {
  if (!address) return "";

  return [
    address?.address1,
    address?.address2,
    address?.city,
    [address?.state, address?.postalCode].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);

    if (!Number.isInteger(businessId) || businessId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid business ID." },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const orderId = Number(body?.orderId);
    const action = String(body?.action || "quote");

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Valid order ID is required." },
        { status: 400 },
      );
    }

    if (action !== "quote" && action !== "dispatch") {
      return NextResponse.json(
        { ok: false, error: "Invalid test action." },
        { status: 400 },
      );
    }

    const db = getOrderAdmin();

    const [
      { data: order, error: orderError },
      { data: business, error: businessError },
      { data: privateSettings, error: privateError },
    ] = await Promise.all([
      db
        .from("restaurant_orders")
        .select(
          `
          id,
          business_id,
          order_number,
          fulfillment_type,
          customer_name,
          customer_phone,
          delivery_address,
          payment_status,
          delivery_provider,
          delivery_quote_id,
          delivery_quote_expires_at,
          delivery_external_id,
          delivery_status,
          delivery_tracking_url,
          delivery_last_error
          `,
        )
        .eq("id", orderId)
        .eq("business_id", businessId)
        .single(),

      db
        .from("businesses")
        .select("*")
        .eq("id", businessId)
        .single(),

      db
        .from("restaurant_order_private_settings")
        .select(
          `
          delivery_provider,
          uber_direct_enabled,
          uber_direct_client_id,
          uber_direct_client_secret,
          uber_direct_customer_id,
          delivery_fee_markup_cents
          `,
        )
        .eq("business_id", businessId)
        .maybeSingle(),
    ]);

    if (orderError || !order) {
      return NextResponse.json(
        {
          ok: false,
          error: "Order not found.",
          detail: orderError?.message || null,
        },
        { status: 404 },
      );
    }

    if (businessError || !business) {
      return NextResponse.json(
        {
          ok: false,
          error: "Business not found.",
          detail: businessError?.message || null,
        },
        { status: 404 },
      );
    }

    if (privateError) {
      return NextResponse.json(
        {
          ok: false,
          error: privateError.message,
        },
        { status: 500 },
      );
    }

    if (order.fulfillment_type !== "delivery") {
      return NextResponse.json(
        {
          ok: false,
          error: "This is not a delivery order.",
          order,
        },
        { status: 400 },
      );
    }

    if (order.payment_status !== "paid") {
      return NextResponse.json(
        {
          ok: false,
          error: "For safety, Uber TEST only accepts an existing PAID order.",
          order,
        },
        { status: 400 },
      );
    }

    if (!isUberDirectEnabled(privateSettings)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Uber Direct is not enabled for this restaurant.",
          order,
        },
        { status: 400 },
      );
    }

    const pickupAddress = pickupAddressForDisplay(business);
    const dropoffAddress = dropoffAddressForDisplay(order.delivery_address);

    // STEP 1: Quote only. This does NOT create an Uber delivery.
    if (action === "quote") {
      if (order.delivery_external_id) {
        return NextResponse.json(
          {
            ok: false,
            error: "Uber Direct delivery already exists for this order.",
            order,
            pickupAddress,
            dropoffAddress,
          },
          { status: 409 },
        );
      }

      console.log("========== UBER DIRECT QUOTE TEST START ==========");
      console.log("Business ID:", businessId);
      console.log("Order ID:", orderId);
      console.log("Order Number:", order.order_number);

      const quote = await createUberDirectQuote({
        business,
        privateSettings,
        dropoffAddress: order.delivery_address,
      });

      const { error: quoteSaveError } = await db
        .from("restaurant_orders")
        .update({
          delivery_provider: "uber_direct",
          delivery_quote_id: quote.id,
          delivery_quote_expires_at: quote.expires || null,
          delivery_status: "quote_ready",
          delivery_last_error: null,
        })
        .eq("id", orderId)
        .eq("business_id", businessId);

      if (quoteSaveError) throw quoteSaveError;

      console.log("UBER DIRECT QUOTE:", quote);
      console.log("========== UBER DIRECT QUOTE TEST END ==========");

      return NextResponse.json({
        ok: true,
        stage: "quote",
        message:
          "Uber Direct quote created. No courier has been dispatched.",
        pickupAddress,
        dropoffAddress,
        quote: {
          id: quote.id,
          uberFeeCents: quote.uberFeeCents,
          markupCents: quote.markupCents,
          customerFeeCents: quote.customerFeeCents,
          currency: quote.currency || quote.currency_type || "USD",
          expires: quote.expires || null,
          duration: quote.duration || 0,
          pickupDuration: quote.pickup_duration || 0,
          dropoffEta: quote.dropoff_eta || null,
          dropoffDeadline: quote.dropoff_deadline || null,
        },
        order: {
          ...order,
          delivery_quote_id: quote.id,
          delivery_quote_expires_at: quote.expires || null,
          delivery_status: "quote_ready",
        },
      });
    }

    // STEP 2: Actual Uber delivery creation.
    if (order.delivery_external_id) {
      return NextResponse.json({
        ok: true,
        stage: "dispatch",
        alreadyDispatched: true,
        message: "Uber Direct delivery already exists.",
        pickupAddress,
        dropoffAddress,
        order,
      });
    }

    console.log("========== UBER DIRECT DISPATCH TEST START ==========");
    console.log("Business ID:", businessId);
    console.log("Order ID:", orderId);
    console.log("Order Number:", order.order_number);
    console.log("Quote ID:", order.delivery_quote_id);

    try {
      // Square / Receipt / SMS calls are intentionally not used here.
      const result = await dispatchUberDirectOrder({
        db,
        businessId,
        orderId,
        prepMinutes: 15,
      });

      const { data: updatedOrder } = await db
        .from("restaurant_orders")
        .select(
          `
          id,
          order_number,
          payment_status,
          delivery_provider,
          delivery_quote_id,
          delivery_quote_expires_at,
          delivery_external_id,
          delivery_status,
          delivery_tracking_url,
          delivery_last_error
          `,
        )
        .eq("id", orderId)
        .eq("business_id", businessId)
        .single();

      console.log("UBER DIRECT DISPATCH RESULT:", result);
      console.log("========== UBER DIRECT DISPATCH TEST END ==========");

      return NextResponse.json({
        ok: true,
        stage: "dispatch",
        message: "Uber Direct delivery creation completed.",
        pickupAddress,
        dropoffAddress,
        uberResult: result,
        order: updatedOrder || order,
      });
    } catch (uberError) {
      const message =
        uberError instanceof Error ? uberError.message : String(uberError);

      console.error("========== UBER DIRECT DISPATCH TEST FAILED ==========");
      console.error("Business ID:", businessId);
      console.error("Order ID:", orderId);
      console.error("ERROR:", message);

      const { data: failedOrder } = await db
        .from("restaurant_orders")
        .select(
          `
          id,
          order_number,
          payment_status,
          delivery_provider,
          delivery_quote_id,
          delivery_quote_expires_at,
          delivery_external_id,
          delivery_status,
          delivery_tracking_url,
          delivery_last_error
          `,
        )
        .eq("id", orderId)
        .eq("business_id", businessId)
        .single();

      return NextResponse.json(
        {
          ok: false,
          stage: "dispatch",
          error: message,
          pickupAddress,
          dropoffAddress,
          order: failedOrder || order,
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("UBER DIRECT TEST ROUTE ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Uber Direct test failed.",
      },
      { status: 500 },
    );
  }
}
