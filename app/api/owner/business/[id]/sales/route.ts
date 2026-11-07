import { NextResponse } from "next/server";
import { getOrderAdmin, requireOrderOwner } from "@/lib/restaurant-order/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const businessId = Number((await context.params).id);
    if (!Number.isSafeInteger(businessId) || businessId <= 0) return NextResponse.json({ error: "Invalid business ID" }, { status: 400 });
    const access = await requireOrderOwner(request, businessId);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    const url = new URL(request.url);
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    const valid = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
    if ((from && !valid(from)) || (to && !valid(to)) || (from && to && from > to)) return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    const db = getOrderAdmin();
    const orders: any[] = [];
    const batchSize = 500;
    for (let offset = 0; ; offset += batchSize) {
      let q = db.from("restaurant_orders")
        .select("id,order_number,created_at,fulfillment_type,customer_name,payment_method,payment_method_type,payment_status,order_status,subtotal,tax,tip,total,restaurant_order_items(id,item_name,quantity,line_total)")
        .eq("business_id", businessId).neq("payment_status", "pending")
        .order("created_at", { ascending: false }).order("id", { ascending: false })
        .range(offset, offset + batchSize - 1);
      const { data, error } = await q;
      if (error) throw error;
      orders.push(...(data || []));
      if (!data || data.length < batchSize) break;
      if (offset >= 99500) return NextResponse.json({ error: "Too many orders for this report. Narrow the date range." }, { status: 422 });
    }
    return NextResponse.json({ orders });
  } catch (error) {
    console.error("SALES REPORT GET ERROR", error);
    return NextResponse.json({ error: "Failed to load sales report" }, { status: 500 });
  }
}
