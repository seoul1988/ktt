import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getOrderAdmin } from "@/lib/restaurant-order/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tokenHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const rawToken = String(token || "").trim();

    if (!rawToken) {
      return NextResponse.json(
        { error: "Invalid tracking link." },
        { status: 400 },
      );
    }

    const db = getOrderAdmin();
    const hash = tokenHash(rawToken);

    const { data: orderData, error } = await db
      .from("restaurant_orders")
      .select(
        [
          "id",
          "business_id",
          "order_number",
          "fulfillment_type",
          "payment_status",
          "order_status",
          "delivery_provider",
          "delivery_status",
          "delivery_tracking_url",
          "delivery_courier",
          "delivery_last_webhook_at",
          "tracking_expires_at",
          "paid_at",
          "requested_time",
        ].join(","),
      )
      .eq("tracking_token_hash", hash)
      .maybeSingle();

    /*
     * getOrderAdmin() is intentionally generic in this project, so Supabase
     * cannot infer the restaurant_orders row shape here. Keep the public
     * response typed locally instead of changing the shared DB client.
     */
    type TrackingOrderRow = {
      id: number | string;
      business_id: number | string;
      order_number: string | null;
      fulfillment_type: string | null;
      payment_status: string | null;
      order_status: string | null;
      delivery_provider: string | null;
      delivery_status: string | null;
      delivery_tracking_url: string | null;
      delivery_courier: unknown;
      delivery_last_webhook_at: string | null;
      tracking_expires_at: string | null;
      paid_at: string | null;
      requested_time: string | null;
    };

    const order = orderData as TrackingOrderRow | null;

    if (error) {
      throw error;
    }

    if (!order) {
      return NextResponse.json(
        { error: "Tracking link not found." },
        { status: 404 },
      );
    }

    const expiresAt = order.tracking_expires_at
      ? new Date(order.tracking_expires_at).getTime()
      : 0;

    if (!expiresAt || Date.now() >= expiresAt) {
      return NextResponse.json(
        {
          ok: true,
          expired: true,
          orderNumber: order.order_number,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    let businessName = "Restaurant";

    const { data: business, error: businessError } = await db
      .from("businesses")
      .select("name")
      .eq("id", order.business_id)
      .maybeSingle();

    if (businessError) {
      console.error("TRACKING BUSINESS LOOKUP ERROR", businessError);
    } else if (business?.name) {
      businessName = String(business.name);
    }

    return NextResponse.json(
      {
        ok: true,
        expired: false,
        order: {
          orderNumber: order.order_number,
          businessName,
          fulfillmentType: order.fulfillment_type,
          paymentStatus: order.payment_status,
          orderStatus: order.order_status,
          requestedTime: order.requested_time,
          delivery:
            order.fulfillment_type === "delivery"
              ? {
                  provider: order.delivery_provider,
                  status: order.delivery_status,
                  trackingUrl: order.delivery_tracking_url || null,
                  courier: order.delivery_courier || null,
                  lastUpdatedAt: order.delivery_last_webhook_at || null,
                }
              : null,
          paidAt: order.paid_at || null,
          trackingExpiresAt: order.tracking_expires_at,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("PUBLIC ORDER TRACKING ERROR", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load order tracking.",
      },
      { status: 500 },
    );
  }
}
