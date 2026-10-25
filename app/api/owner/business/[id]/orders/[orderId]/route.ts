import { NextResponse } from "next/server";
import { getOrderAdmin, requireOrderOwner } from "@/lib/restaurant-order/server";
import { sendOrderNotifications } from "@/lib/restaurant-order/order-notifications";

const ALLOWED = new Set(["new", "preparing", "ready", "completed", "cancelled"]);
type OrderStatus = "new" | "preparing" | "ready" | "completed" | "cancelled";

export async function PATCH(request: Request, context: { params: Promise<{ id: string; orderId: string }> }) {
  try {
    const { id, orderId } = await context.params;
    const businessId = Number(id);
    const orderNumericId = Number(orderId);
    if (!Number.isInteger(businessId) || businessId <= 0 || !Number.isInteger(orderNumericId) || orderNumericId <= 0) return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
    const access = await requireOrderOwner(request, businessId);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    const body = await request.json();
    const status = String(body?.status || "");
    if (!ALLOWED.has(status)) return NextResponse.json({ error: "Invalid order status." }, { status: 400 });
    const db = getOrderAdmin();
    const { data: previous, error: readError } = await db.from("restaurant_orders")
      .select("id,order_number,customer_phone,fulfillment_type,order_status")
      .eq("id", orderNumericId).eq("business_id", businessId).single();
    if (readError || !previous) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (previous.order_status === status) return NextResponse.json({ ok: true, order: previous, unchanged: true });
    const { data: order, error } = await db.from("restaurant_orders")
      .update({ order_status: status, updated_at: new Date().toISOString() })
      .eq("id", orderNumericId).eq("business_id", businessId).eq("order_status", previous.order_status)
      .select("id,order_number,customer_phone,fulfillment_type,order_status").maybeSingle();
    if (error) throw error;
    if (!order) return NextResponse.json({ error: "Order changed. Refresh and try again." }, { status: 409 });
    const notifications = await sendOrderNotifications({ db, businessId, orderId: orderNumericId, event: status as OrderStatus });
    return NextResponse.json({ ok: true, order, notifications });
  } catch (error) {
    console.error("OWNER ORDER PATCH ERROR", error);
    return NextResponse.json({ error: "Could not update the order status." }, { status: 500 });
  }
}
