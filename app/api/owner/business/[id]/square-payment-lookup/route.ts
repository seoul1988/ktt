import { NextResponse } from "next/server";
import { getOrderAdmin, requireOrderOwner } from "@/lib/restaurant-order/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const businessId = Number((await context.params).id);
    if (!Number.isInteger(businessId) || businessId <= 0) {
      return NextResponse.json({ error: "Invalid business ID." }, { status: 400 });
    }
    const access = await requireOrderOwner(request, businessId);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

    const orderNumber = new URL(request.url).searchParams.get("orderNumber")?.trim() || "";
    if (!/^\d{1,30}$/.test(orderNumber)) {
      return NextResponse.json({ error: "Enter a valid order number." }, { status: 400 });
    }

    const db = getOrderAdmin();
    const { data: orders, error: orderError } = await db.from("restaurant_orders")
      .select("id,order_number,payment_status,payment_method_type,square_order_id,square_payment_id,created_at")
      .eq("business_id", businessId).eq("order_number", orderNumber).limit(2);
    if (orderError) throw orderError;
    if (!orders?.length) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (orders.length > 1) return NextResponse.json({ error: "Multiple orders have this number. Contact administrator." }, { status: 409 });
    const order = orders[0];
    if (!order.square_payment_id) {
      return NextResponse.json({ order, square: null, explanation: "No Square payment ID is stored for this order. Square payment details cannot be fetched by payment ID." });
    }

    const { data: settings, error: settingsError } = await db.from("restaurant_order_private_settings")
      .select("payment_provider,square_access_token")
      .eq("business_id", businessId).maybeSingle();
    if (settingsError) throw settingsError;
    if (settings?.payment_provider !== "square" || !settings.square_access_token) {
      return NextResponse.json({ error: "Square is not configured for this restaurant." }, { status: 400 });
    }

    const squareResponse = await fetch(
      `https://connect.squareup.com/v2/payments/${encodeURIComponent(String(order.square_payment_id))}`,
      { headers: { Authorization: `Bearer ${settings.square_access_token}`, "Square-Version": "2026-08-19" }, cache: "no-store" },
    );
    const raw = await squareResponse.text();
    let payload: any;
    try { payload = raw ? JSON.parse(raw) : {}; }
    catch { return NextResponse.json({ error: `Square returned invalid JSON (HTTP ${squareResponse.status}).` }, { status: 502 }); }
    if (!squareResponse.ok) {
      return NextResponse.json({
        order,
        error: "Square payment lookup failed.",
        squareHttpStatus: squareResponse.status,
        squareErrors: Array.isArray(payload.errors) ? payload.errors.map((e: any) => ({ category: e.category || null, code: e.code || null, detail: e.detail || null, field: e.field || null })) : [],
      }, { status: 502 });
    }
    const p = payload.payment;
    if (!p) return NextResponse.json({ error: "Square response contained no payment." }, { status: 502 });
    return NextResponse.json({
      order,
      square: {
        id: p.id || null, status: p.status || null, sourceType: p.source_type || null,
        createdAt: p.created_at || null, updatedAt: p.updated_at || null,
        amount: p.amount_money?.amount ?? null, currency: p.amount_money?.currency || null,
        orderId: p.order_id || null, receiptNumber: p.receipt_number || null,
        cardStatus: p.card_details?.status || null,
        cardBrand: p.card_details?.card?.card_brand || null,
        digitalWalletType: p.card_details?.card?.digital_wallet_type || null,
        entryMethod: p.card_details?.entry_method || null,
        cvvStatus: p.card_details?.cvv_status || null,
        avsStatus: p.card_details?.avs_status || null,
      },
      explanation: "Square may not expose the exact cancellation reason for a CANCELED payment.",
    });
  } catch (e) {
    console.error("SQUARE PAYMENT LOOKUP ERROR", e instanceof Error ? e.message : "Unknown error");
    return NextResponse.json({ error: "Payment lookup failed. Check server logs." }, { status: 500 });
  }
}
