import { NextResponse } from "next/server";
import { getOrderAdmin, requireOrderOwner } from "@/lib/restaurant-order/server";
import { sendTwilioSms } from "@/lib/restaurant-order/twilio";

const ALLOWED = new Set(["new", "preparing", "ready", "completed", "cancelled"]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string; orderId: string }> }) {
  try {
    const { id, orderId } = await context.params;
    const businessId = Number(id);
    const orderNumericId = Number(orderId);
    const access = await requireOrderOwner(request, businessId);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    const body = await request.json();
    const status = String(body?.status || "");
    if (!ALLOWED.has(status)) return NextResponse.json({ error: "Invalid order status" }, { status: 400 });
    const db = getOrderAdmin();
    const { data: order, error } = await db.from("restaurant_orders").update({ order_status: status, updated_at: new Date().toISOString() }).eq("id", orderNumericId).eq("business_id", businessId).select("id,order_number,customer_phone,fulfillment_type").single();
    if (error) throw error;
    if (status === "ready") {
      const [{ data: business }, { data: s }, { data: p }] = await Promise.all([
        db.from("businesses").select("name").eq("id", businessId).single(),
        db.from("restaurant_order_settings").select("sms_enabled").eq("business_id", businessId).maybeSingle(),
        db.from("restaurant_order_private_settings").select("twilio_account_sid,twilio_auth_token,twilio_phone_number").eq("business_id", businessId).maybeSingle(),
      ]);
      if (s?.sms_enabled && p?.twilio_account_sid && p?.twilio_auth_token && p?.twilio_phone_number && order.customer_phone) {
        await sendTwilioSms({ accountSid: p.twilio_account_sid, authToken: p.twilio_auth_token, fromNumber: p.twilio_phone_number }, order.customer_phone, `${business?.name || "Restaurant"}: Order #${order.order_number} is READY${order.fulfillment_type === "pickup" ? " for pickup" : ""}.`);
      }
    }
    return NextResponse.json({ ok: true, order });
  } catch (e) {
    console.error("OWNER ORDER PATCH ERROR", e);
    return NextResponse.json({ error: "주문 상태 변경에 실패했습니다." }, { status: 500 });
  }
}
