import { NextResponse } from "next/server";
import { getOrderAdmin } from "@/lib/restaurant-order/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// At least 20 paid orders in the last 30 days are required to show Popular Picks.
const MIN_PAID_ORDERS = 20;
const PAGE_SIZE = 500;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);
    if (!Number.isInteger(businessId) || businessId <= 0) {
      return NextResponse.json({ error: "Invalid business ID" }, { status: 400 });
    }
    const db = getOrderAdmin();
    const { data: settings, error: settingsError } = await db
      .from("restaurant_order_settings")
      .select("popular_picks_enabled")
      .eq("business_id", businessId)
      .maybeSingle();
    if (settingsError) throw settingsError;
    if (settings?.popular_picks_enabled === false) {
      return NextResponse.json({ itemIds: [], eligible: false, enabled: false });
    }
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const paidOrderIds: number[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await db.from("restaurant_orders")
        .select("id")
        .eq("business_id", businessId)
        .gte("created_at", since)
        .eq("payment_status", "paid")
        .not("order_status", "in", '(cancelled,canceled,refunded)')
        .order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      for (const order of data || []) paidOrderIds.push(Number(order.id));
      if (!data || data.length < PAGE_SIZE) break;
    }
    if (paidOrderIds.length < MIN_PAID_ORDERS) {
      return NextResponse.json({ itemIds: [], eligible: false, enabled: true, paidOrders: paidOrderIds.length });
    }
    const sold = new Map<number, number>();
    // Chunk order IDs to keep URL query lengths reasonable.
    for (let i = 0; i < paidOrderIds.length; i += 100) {
      const ids = paidOrderIds.slice(i, i + 100);
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await db.from("restaurant_order_items")
          .select("menu_item_id,quantity")
          .eq("business_id", businessId)
          .in("order_id", ids)
          .not("menu_item_id", "is", null)
          .range(offset, offset + PAGE_SIZE - 1);
        if (error) throw error;
        for (const item of data || []) {
          const itemId = Number(item.menu_item_id);
          if (Number.isInteger(itemId) && itemId > 0) sold.set(itemId, (sold.get(itemId) || 0) + Math.max(0, Number(item.quantity) || 0));
        }
        if (!data || data.length < PAGE_SIZE) break;
      }
    }
    const itemIds = [...sold.entries()].sort((a,b) => b[1] - a[1] || a[0] - b[0]).slice(0, 3).map(([id]) => id);
    return NextResponse.json({ itemIds, eligible: true, enabled: true, paidOrders: paidOrderIds.length });
  } catch (error) {
    console.error("Popular Picks lookup failed", error);
    return NextResponse.json({ error: "Unable to load popular items", itemIds: [], enabled: false, eligible: false }, { status: 500 });
  }
}
