import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getOrderAdmin } from "@/lib/restaurant-order/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeEqualHex(a: string, b: string) {
  try {
    const left = Buffer.from(a.toLowerCase(), "hex");
    const right = Buffer.from(b.toLowerCase(), "hex");

    return (
      left.length === right.length &&
      left.length > 0 &&
      timingSafeEqual(left, right)
    );
  } catch {
    return false;
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "uber-direct-webhook",
  });
}

export async function POST(request: Request) {
  const raw = await request.text();

  try {
    const signingKey = String(
      process.env.UBER_DIRECT_WEBHOOK_SIGNING_KEY || "",
    ).trim();

    if (!signingKey) {
      return NextResponse.json(
        { error: "Webhook signing key is not configured." },
        { status: 500 },
      );
    }

    const received =
      request.headers.get("x-uber-signature") ||
      request.headers.get("x-postmates-signature") ||
      "";

    const expected = createHmac("sha256", signingKey)
      .update(raw, "utf8")
      .digest("hex");

    if (!received || !safeEqualHex(received, expected)) {
      return NextResponse.json(
        { error: "Invalid webhook signature." },
        { status: 401 },
      );
    }

    const payload = raw ? JSON.parse(raw) : {};
    const db = getOrderAdmin();

    const deliveryId = String(
      payload?.delivery_id ||
        payload?.id ||
        payload?.meta?.delivery_id ||
        payload?.meta?.order_id ||
        "",
    );

    const externalReference = String(
      payload?.external_id ||
        payload?.manifest?.reference ||
        payload?.meta?.external_order_id ||
        "",
    );

    const status = String(
      payload?.status ||
        payload?.event?.status ||
        payload?.meta?.status ||
        payload?.kind ||
        payload?.event_type ||
        "updated",
    );

    const courier =
      payload?.courier ||
      (payload?.location
        ? {
            location: payload.location,
          }
        : null);

    const trackingUrl = String(
      payload?.tracking_url ||
        payload?.order_tracking_url ||
        "",
    );

    let query = db.from("restaurant_orders").update({
      delivery_status: status,
      ...(trackingUrl
        ? { delivery_tracking_url: trackingUrl }
        : {}),
      ...(courier
        ? { delivery_courier: courier }
        : {}),
      delivery_last_webhook_at: new Date().toISOString(),
      delivery_last_error: null,
    });

    if (deliveryId) {
      query = query.eq("delivery_external_id", deliveryId);
    } else {
      const match = externalReference.match(/KTOWN-(\d+)/i);

      if (!match) {
        return NextResponse.json({
          ok: true,
          ignored: true,
          reason: "no_delivery_reference",
        });
      }

      query = query.eq("order_number", match[1]);
    }

    const { error } = await query;

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Uber Direct webhook error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Webhook processing failed.",
      },
      { status: 500 },
    );
  }
}
