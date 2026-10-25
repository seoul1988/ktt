import { NextResponse } from "next/server";
import { getOrderAdmin } from "@/lib/restaurant-order/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MIN_PAID_ORDERS = 20;
const PAGE_SIZE = 500;
const TOP_CLICK_ITEMS = 10;

function easternDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(dateText: string, amount: number) {
  const date = new Date(`${dateText}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

type ClickRow = {
  menu_item_id: number;
  menu_item_name: string | null;
  visitor_hash: string;
  click_count: number;
};

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

    // Preserve the existing minimum of 20 paid, non-cancelled orders in 30 days.
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    let paidOrders = 0;
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await db.from("restaurant_orders")
        .select("id")
        .eq("business_id", businessId)
        .gte("created_at", since)
        .eq("payment_status", "paid")
        .not("order_status", "in", "(cancelled,canceled,refunded)")
        .order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      paidOrders += data?.length || 0;
      if (!data || data.length < PAGE_SIZE) break;
    }
    if (paidOrders < MIN_PAID_ORDERS) {
      return NextResponse.json({ itemIds: [], eligible: false, enabled: true, paidOrders });
    }

    // Match the owner's visitor analytics: last 30 Eastern calendar days,
    // summed click_count, then distinct visitors, then item name.
    const today = easternDate();
    const thirtyDaysAgo = addDays(today, -29);
    const totals = new Map<number, { id: number; name: string; clicks: number; visitors: Set<string> }>();
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await db.from("business_menu_clicks")
        .select("menu_item_id,menu_item_name,visitor_hash,click_count")
        .eq("business_id", businessId)
        .gte("click_date", thirtyDaysAgo)
        .lte("click_date", today)
        .order("click_date", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      for (const row of (data || []) as ClickRow[]) {
        const itemId = Number(row.menu_item_id);
        if (!Number.isInteger(itemId) || itemId <= 0) continue;
        const current = totals.get(itemId) || {
          id: itemId, name: row.menu_item_name || "", clicks: 0, visitors: new Set<string>(),
        };
        current.clicks += Math.max(0, Number(row.click_count) || 0);
        if (row.visitor_hash) current.visitors.add(row.visitor_hash);
        current.name = row.menu_item_name || current.name;
        totals.set(itemId, current);
      }
      if (!data || data.length < PAGE_SIZE) break;
    }

    const itemIds = [...totals.values()]
      .sort((a, b) => b.clicks - a.clicks || b.visitors.size - a.visitors.size || a.name.localeCompare(b.name))
      .slice(0, TOP_CLICK_ITEMS)
      .map((row) => row.id);

    // The client applies the original-price >= $8 filter and selects 3.
    return NextResponse.json({ itemIds, eligible: true, enabled: true, paidOrders });
  } catch (error) {
    console.error("Popular Picks lookup failed", error);
    return NextResponse.json(
      { error: "Unable to load popular items", itemIds: [], enabled: false, eligible: false },
      { status: 500 },
    );
  }
}
