import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getOrderAdmin } from "@/lib/restaurant-order/server";
import { sendTwilioSms } from "@/lib/restaurant-order/twilio";

export const runtime = "nodejs";

function verifyStripeSignature(raw: string, signatureHeader: string, secret: string) {
  const parts = signatureHeader.split(",").map((x) => x.trim());
  const timestamp = parts.find((x) => x.startsWith("t="))?.slice(2) || "";
  const signatures = parts.filter((x) => x.startsWith("v1=")).map((x) => x.slice(3));
  if (!timestamp || !signatures.length) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${raw}`, "utf8").digest("hex");
  return signatures.some((sig) => {
    try {
      const a = Buffer.from(sig, "hex");
      const b = Buffer.from(expected, "hex");
      return a.length === b.length && timingSafeEqual(a, b);
    } catch { return false; }
  });
}

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("stripe-signature") || "";
  try {
    const db = getOrderAdmin();
    const { data: privateRows, error } = await db.from("restaurant_order_private_settings").select("business_id,stripe_webhook_secret").not("stripe_webhook_secret", "is", null);
    if (error) throw error;
    const matched = (privateRows || []).find((row) => row.stripe_webhook_secret && verifyStripeSignature(raw, signature, row.stripe_webhook_secret));
    if (!matched) return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 });

    const event = JSON.parse(raw);
    if (event?.type !== "checkout.session.completed" && event?.type !== "checkout.session.async_payment_succeeded") return NextResponse.json({ received: true });
    const session = event?.data?.object || {};
    const orderId = Number(session?.metadata?.order_id || session?.client_reference_id);
    const businessId = Number(session?.metadata?.business_id || matched.business_id);
    if (!Number.isInteger(orderId) || !Number.isInteger(businessId)) return NextResponse.json({ received: true });

    const { data: order, error: orderError } = await db.from("restaurant_orders").update({ payment_status: "paid", stripe_session_id: session.id || null, updated_at: new Date().toISOString() }).eq("id", orderId).eq("business_id", businessId).select("id,order_number,customer_phone,fulfillment_type").single();
    if (orderError) throw orderError;

    const [{ data: business }, { data: settings }, { data: priv }] = await Promise.all([
      db.from("businesses").select("name").eq("id", businessId).single(),
      db.from("restaurant_order_settings").select("sms_enabled").eq("business_id", businessId).maybeSingle(),
      db.from("restaurant_order_private_settings").select("twilio_account_sid,twilio_auth_token,twilio_phone_number").eq("business_id", businessId).maybeSingle(),
    ]);
    if (settings?.sms_enabled && priv?.twilio_account_sid && priv?.twilio_auth_token && priv?.twilio_phone_number && order.customer_phone) {
      await sendTwilioSms({ accountSid: priv.twilio_account_sid, authToken: priv.twilio_auth_token, fromNumber: priv.twilio_phone_number }, order.customer_phone, `${business?.name || "Restaurant"}: Payment received for order #${order.order_number}. ${order.fulfillment_type === "pickup" ? "We'll text you when it's ready." : "Your delivery order is being prepared."}`);
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("STRIPE WEBHOOK ERROR", e);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
