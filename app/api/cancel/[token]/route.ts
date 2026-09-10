import { createHash } from "crypto";
import { NextResponse } from "next/server";
import {
  getOrderAdmin,
  moneyCents,
} from "@/lib/restaurant-order/server";
import { cancelUberDirectDelivery } from "@/lib/delivery/uber-direct";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tokenHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function cleanToken(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 200);
}

function secondsRemaining(expiresAt: string | null) {
  if (!expiresAt) return 0;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 1000));
}

async function findOrder(token: string) {
  const db = getOrderAdmin();
  const hash = tokenHash(token);

  const { data: order, error } = await db
    .from("restaurant_orders")
    .select(
      "id,business_id,order_number,fulfillment_type,total,payment_status,order_status,square_payment_id,delivery_provider,delivery_external_id,delivery_status,cancel_expires_at,cancelled_at,refund_status,square_refund_id",
    )
    .eq("cancel_token_hash", hash)
    .maybeSingle();

  if (error) throw error;
  return { db, order };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token: rawToken } = await context.params;
    const token = cleanToken(rawToken);

    if (!token) {
      return NextResponse.json(
        { error: "Invalid cancellation link." },
        { status: 400 },
      );
    }

    const { db, order } = await findOrder(token);

    if (!order) {
      return NextResponse.json(
        { error: "Cancellation link not found." },
        { status: 404 },
      );
    }

    const { data: business } = await db
      .from("businesses")
      .select("name")
      .eq("id", order.business_id)
      .maybeSingle();

    const remaining = secondsRemaining(order.cancel_expires_at);
    const alreadyCancelled =
      order.order_status === "cancelled" || !!order.cancelled_at;

    return NextResponse.json({
      ok: true,
      orderNumber: order.order_number,
      businessName: business?.name || "Restaurant",
      fulfillmentType: order.fulfillment_type,
      total: Number(order.total || 0),
      paymentStatus: order.payment_status,
      orderStatus: order.order_status,
      cancelExpiresAt: order.cancel_expires_at,
      secondsRemaining: remaining,
      cancelled: alreadyCancelled,
      cancellable:
        !alreadyCancelled &&
        order.payment_status === "paid" &&
        remaining > 0,
    });
  } catch (error) {
    console.error("CANCEL ORDER GET ERROR", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load order.",
      },
      { status: 500 },
    );
  }
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token: rawToken } = await context.params;
    const token = cleanToken(rawToken);

    if (!token) {
      return NextResponse.json(
        { error: "Invalid cancellation link." },
        { status: 400 },
      );
    }

    const { db, order } = await findOrder(token);

    if (!order) {
      return NextResponse.json(
        { error: "Cancellation link not found." },
        { status: 404 },
      );
    }

    if (
      order.order_status === "cancelled" ||
      order.cancelled_at
    ) {
      return NextResponse.json({
        ok: true,
        alreadyCancelled: true,
        orderNumber: order.order_number,
        refundStatus: order.refund_status || null,
      });
    }

    const remaining = secondsRemaining(order.cancel_expires_at);

    if (remaining <= 0) {
      return NextResponse.json(
        {
          error:
            "The 3-minute cancellation period has expired. Please contact the restaurant directly.",
          expired: true,
        },
        { status: 410 },
      );
    }

    if (
      order.payment_status !== "paid" ||
      !order.square_payment_id
    ) {
      return NextResponse.json(
        {
          error:
            "This order is not eligible for automatic cancellation.",
        },
        { status: 409 },
      );
    }

    const { data: privateSettings, error: privateError } = await db
      .from("restaurant_order_private_settings")
      .select(
        "payment_provider,square_access_token,delivery_provider,uber_direct_enabled,uber_direct_customer_id",
      )
      .eq("business_id", order.business_id)
      .maybeSingle();

    if (privateError) throw privateError;

    if (
      privateSettings?.payment_provider !== "square" ||
      !privateSettings?.square_access_token
    ) {
      return NextResponse.json(
        {
          error:
            "Automatic refund is not configured for this restaurant.",
        },
        { status: 409 },
      );
    }

    const amountCents = moneyCents(Number(order.total || 0));

    if (amountCents <= 0) {
      return NextResponse.json(
        { error: "Invalid refund amount." },
        { status: 400 },
      );
    }

    // Same idempotency key makes repeated customer taps safe.
    const refundResponse = await fetch(
      "https://connect.squareup.com/v2/refunds",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${privateSettings.square_access_token}`,
          "Content-Type": "application/json",
          "Square-Version": "2026-08-19",
        },
        body: JSON.stringify({
          idempotency_key: `ktown-cancel-${order.id}`,
          amount_money: {
            amount: amountCents,
            currency: "USD",
          },
          payment_id: order.square_payment_id,
          reason: `Customer cancelled KTown order #${order.order_number} within 3 minutes`,
        }),
        cache: "no-store",
      },
    );

    const refundPayload = await refundResponse
      .json()
      .catch(() => ({}));

    if (!refundResponse.ok) {
      const detail =
        refundPayload?.errors?.[0]?.detail ||
        refundPayload?.errors?.[0]?.code ||
        refundPayload?.message ||
        `Square refund failed (HTTP ${refundResponse.status}).`;

      return NextResponse.json(
        { error: detail },
        { status: 502 },
      );
    }

    const refund = refundPayload?.refund || {};
    const refundId = String(refund?.id || "");
    const refundStatus = String(refund?.status || "PENDING");

    let uberCancellation: any = null;
    let deliveryStatus = order.delivery_status || null;
    let deliveryLastError: string | null = null;

    if (
      order.fulfillment_type === "delivery" &&
      order.delivery_provider === "uber_direct" &&
      order.delivery_external_id
    ) {
      try {
        uberCancellation = await cancelUberDirectDelivery({
          privateSettings,
          deliveryId: String(order.delivery_external_id),
        });
        deliveryStatus = "cancelled";
      } catch (uberError) {
        deliveryStatus = "cancel_failed";
        deliveryLastError =
          uberError instanceof Error
            ? uberError.message
            : "Uber Direct cancellation failed.";
        console.error(
          "UBER DIRECT CANCEL AFTER CUSTOMER CANCEL ERROR",
          uberError,
        );
      }
    }

    const cancelledAt = new Date().toISOString();
    const finalPaymentStatus =
      refundStatus === "COMPLETED" ? "refunded" : "refund_pending";

    const { error: saveError } = await db
      .from("restaurant_orders")
      .update({
        order_status: "cancelled",
        payment_status: finalPaymentStatus,
        cancelled_at: cancelledAt,
        cancel_reason: "customer_3_minute_cancel",
        refund_status: refundStatus,
        square_refund_id: refundId || null,
        delivery_status: deliveryStatus,
        delivery_last_error: deliveryLastError,
      })
      .eq("id", order.id)
      .eq("business_id", order.business_id);

    if (saveError) throw saveError;

    return NextResponse.json({
      ok: true,
      cancelled: true,
      orderNumber: order.order_number,
      refundStatus,
      refundId: refundId || null,
      uberCancellation,
      deliveryCancellationWarning:
        deliveryStatus === "cancel_failed"
          ? "The food order was refunded, but the delivery cancellation needs restaurant attention."
          : null,
    });
  } catch (error) {
    console.error("CANCEL ORDER POST ERROR", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to cancel order.",
      },
      { status: 500 },
    );
  }
}
