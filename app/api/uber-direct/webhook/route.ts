import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getOrderAdmin } from "@/lib/restaurant-order/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeEqualHex(a: string, b: string) {
  try {
    const left = Buffer.from(String(a || "").toLowerCase(), "hex");
    const right = Buffer.from(String(b || "").toLowerCase(), "hex");

    return (
      left.length === right.length &&
      left.length > 0 &&
      timingSafeEqual(left, right)
    );
  } catch {
    return false;
  }
}

function stringValue(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function extractReferences(payload: any) {
  const data = payload?.data || {};

  const deliveryId = stringValue(
    payload?.delivery_id,
    data?.id,
    data?.delivery_id,
    payload?.id,
    payload?.meta?.delivery_id,
    payload?.meta?.order_id,
  );

  const externalReference = stringValue(
    data?.manifest_reference,
    data?.manifest?.reference,
    payload?.external_id,
    payload?.manifest_reference,
    payload?.manifest?.reference,
    payload?.meta?.external_order_id,
  );

  return { deliveryId, externalReference };
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
    const received =
      request.headers.get("x-uber-signature") ||
      request.headers.get("x-postmates-signature") ||
      "";

    if (!received) {
      return NextResponse.json(
        { error: "Missing webhook signature." },
        { status: 401 },
      );
    }

    const payload = raw ? JSON.parse(raw) : {};
    const eventType = stringValue(payload?.kind, payload?.event_type);

    if (
      eventType &&
      eventType !== "event.delivery_status" &&
      eventType !== "event.courier_update"
    ) {
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: "unsupported_event",
        eventType,
      });
    }

    const { deliveryId, externalReference } = extractReferences(payload);
    const db = getOrderAdmin();

    let orderQuery = db
      .from("restaurant_orders")
      .select("id,business_id,order_number,delivery_external_id")
      .limit(1);

    if (deliveryId) {
      orderQuery = orderQuery.eq("delivery_external_id", deliveryId);
    } else {
      const match = externalReference.match(/KTOWN-(\d+)/i);

      if (!match) {
        return NextResponse.json({
          ok: true,
          ignored: true,
          reason: "no_delivery_reference",
          eventType: eventType || null,
        });
      }

      orderQuery = orderQuery.eq("order_number", match[1]);
    }

    const { data: order, error: orderError } =
      await orderQuery.maybeSingle();

    if (orderError) throw orderError;

    if (!order) {
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: "order_not_found",
        eventType: eventType || null,
        deliveryId: deliveryId || null,
        externalReference: externalReference || null,
      });
    }

    const { data: settings, error: settingsError } = await db
      .from("restaurant_order_private_settings")
      .select("uber_direct_webhook_signing_key")
      .eq("business_id", order.business_id)
      .maybeSingle();

    if (settingsError) throw settingsError;

    const signingKey = String(
      settings?.uber_direct_webhook_signing_key || "",
    ).trim();

    if (!signingKey) {
      return NextResponse.json(
        {
          error:
            "Restaurant webhook signing key is not configured.",
        },
        { status: 500 },
      );
    }

    // Verify the signature against the exact raw request body.
    const expected = createHmac("sha256", signingKey)
      .update(raw, "utf8")
      .digest("hex");

    if (!safeEqualHex(received, expected)) {
      return NextResponse.json(
        { error: "Invalid webhook signature." },
        { status: 401 },
      );
    }

    const data = payload?.data || {};

    const status = stringValue(
      payload?.status,
      data?.status,
      payload?.event?.status,
      payload?.meta?.status,
      payload?.kind,
      payload?.event_type,
      "updated",
    );

    const courier =
      data?.courier ||
      payload?.courier ||
      (payload?.location
        ? { location: payload.location }
        : data?.location
          ? { location: data.location }
          : null);

    const trackingUrl = stringValue(
      data?.tracking_url,
      data?.tracking_url_v2,
      data?.order_tracking_url,
      payload?.tracking_url,
      payload?.order_tracking_url,
    );

    const { error: updateError } = await db
      .from("restaurant_orders")
      .update({
        delivery_status: status,
        ...(trackingUrl
          ? { delivery_tracking_url: trackingUrl }
          : {}),
        ...(courier ? { delivery_courier: courier } : {}),
        delivery_last_webhook_at: new Date().toISOString(),
        delivery_last_error: null,
      })
      .eq("id", order.id)
      .eq("business_id", order.business_id);

    if (updateError) throw updateError;

    return NextResponse.json({
      ok: true,
      eventType: eventType || null,
      orderId: order.id,
      deliveryStatus: status,
    });
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
