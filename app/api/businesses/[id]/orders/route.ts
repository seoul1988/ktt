import { NextResponse } from "next/server";
import { getOrderAdmin, cleanPhone, moneyCents } from "@/lib/restaurant-order/server";
import { createStripeCheckoutSession } from "@/lib/restaurant-order/stripe";
import { sendTwilioSms } from "@/lib/restaurant-order/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestItem = { menuItemId: number; quantity: number; instructions?: string; selections?: unknown };

function orderNumber() { return `${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 90 + 10)}`; }

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);
    if (!Number.isInteger(businessId) || businessId <= 0) return NextResponse.json({ error: "Invalid business id" }, { status: 400 });
    const body = await request.json();
    const fulfillmentType = body?.fulfillmentType === "delivery" ? "delivery" : "pickup";
    const paymentMethod = body?.paymentMethod === "pay_at_pickup" ? "pay_at_pickup" : "online";
    const customerName = String(body?.customer?.name || "").trim().slice(0, 120);
    const customerPhone = cleanPhone(body?.customer?.phone);
    const items: RequestItem[] = Array.isArray(body?.items) ? body.items : [];
    if (!customerName || !customerPhone) return NextResponse.json({ error: "이름과 전화번호가 필요합니다." }, { status: 400 });
    if (!items.length) return NextResponse.json({ error: "장바구니가 비어 있습니다." }, { status: 400 });
    if (fulfillmentType === "delivery") {
      const a = body?.deliveryAddress || {};
      if (!a.address1 || !a.city || !a.state || !a.postalCode) return NextResponse.json({ error: "배달 주소가 필요합니다." }, { status: 400 });
    }

    const db = getOrderAdmin();
    const [{ data: business }, { data: settings }, { data: privateSettings }] = await Promise.all([
      db.from("businesses").select("id,name").eq("id", businessId).single(),
      db.from("restaurant_order_settings").select("pickup_enabled,delivery_enabled,pay_at_pickup_enabled,sms_enabled,tax_rate").eq("business_id", businessId).maybeSingle(),
      db.from("restaurant_order_private_settings").select("stripe_secret_key,twilio_account_sid,twilio_auth_token,twilio_phone_number").eq("business_id", businessId).maybeSingle(),
    ]);
    if (fulfillmentType === "pickup" && settings?.pickup_enabled === false) return NextResponse.json({ error: "Pickup 주문이 비활성화되어 있습니다." }, { status: 400 });
    if (fulfillmentType === "delivery" && settings?.delivery_enabled !== true) return NextResponse.json({ error: "Delivery 주문이 비활성화되어 있습니다." }, { status: 400 });
    if (paymentMethod === "pay_at_pickup" && (fulfillmentType !== "pickup" || settings?.pay_at_pickup_enabled === false)) return NextResponse.json({ error: "Pay at Pickup을 사용할 수 없습니다." }, { status: 400 });
    if (paymentMethod === "online" && !privateSettings?.stripe_secret_key) return NextResponse.json({ error: "온라인 결제가 아직 설정되지 않았습니다." }, { status: 400 });

    const ids = [...new Set(items.map((x) => Number(x.menuItemId)).filter((x) => Number.isInteger(x) && x > 0))];
    const { data: menuRows, error: menuError } = await db.from("business_menu_items").select("id,name,price,pickup_price,delivery_price,is_available").eq("business_id", businessId).in("id", ids);
    if (menuError) throw menuError;
    const menuMap = new Map((menuRows || []).map((r) => [Number(r.id), r]));

    const normalized = items.map((item) => {
      const row: any = menuMap.get(Number(item.menuItemId));
      if (!row || row.is_available === false) throw new Error("주문할 수 없는 메뉴가 포함되어 있습니다.");
      const quantity = Math.min(99, Math.max(1, Number(item.quantity) || 1));
      const base = Number(row.price || 0);
      const pickup = row.pickup_price == null ? base : Number(row.pickup_price);
      const delivery = row.delivery_price == null ? pickup : Number(row.delivery_price);
      const unitPrice = fulfillmentType === "delivery" ? delivery : pickup;
      return { menuItemId: Number(row.id), name: String(row.name), quantity, unitPrice, lineTotal: unitPrice * quantity, instructions: String(item.instructions || "").slice(0, 500), selections: item.selections ?? null };
    });

    const subtotal = normalized.reduce((s, x) => s + x.lineTotal, 0);
    const taxRate = Math.max(0, Number(settings?.tax_rate || 0));
    const tax = subtotal * taxRate;
    const tipPercent = Math.max(0, Math.min(100, Number(body?.tipPercent || 0)));
    const tip = subtotal * (tipPercent / 100);
    const total = subtotal + tax + tip;
    const number = orderNumber();

    const address = fulfillmentType === "delivery" ? body.deliveryAddress : null;
    const { data: order, error: orderError } = await db.from("restaurant_orders").insert({
      business_id: businessId, order_number: number, fulfillment_type: fulfillmentType,
      customer_name: customerName, customer_phone: customerPhone,
      delivery_address: address, requested_time: String(body?.requestedTime || "asap").slice(0, 80),
      payment_method: paymentMethod, payment_status: paymentMethod === "pay_at_pickup" ? "pay_at_pickup" : "pending",
      order_status: "new", subtotal, tax, tip, total,
    }).select("id").single();
    if (orderError) throw orderError;

    const { error: itemsError } = await db.from("restaurant_order_items").insert(normalized.map((x) => ({
      order_id: order.id, business_id: businessId, menu_item_id: x.menuItemId, item_name: x.name,
      quantity: x.quantity, unit_price: x.unitPrice, line_total: x.lineTotal, instructions: x.instructions, selections: x.selections,
    })));
    if (itemsError) throw itemsError;

    if (paymentMethod === "online") {
      const origin = new URL(request.url).origin;
      const session = await createStripeCheckoutSession({ secretKey: privateSettings.stripe_secret_key, orderId: order.id, orderNumber: number, businessId, businessName: business?.name || "Restaurant", amountCents: moneyCents(total), customerName, customerPhone, origin });
      await db.from("restaurant_orders").update({ stripe_session_id: session.id }).eq("id", order.id);
      return NextResponse.json({ ok: true, orderId: order.id, orderNumber: number, checkoutUrl: session.url });
    }

    if (settings?.sms_enabled && privateSettings?.twilio_account_sid && privateSettings?.twilio_auth_token && privateSettings?.twilio_phone_number) {
      sendTwilioSms({ accountSid: privateSettings.twilio_account_sid, authToken: privateSettings.twilio_auth_token, fromNumber: privateSettings.twilio_phone_number }, customerPhone, `${business?.name || "Restaurant"}: Order #${number} received. ${fulfillmentType === "pickup" ? "We'll text you when it's ready." : "Your delivery order is being prepared."}`).catch((e) => console.error("ORDER SMS ERROR", e));
    }

    return NextResponse.json({ ok: true, orderId: order.id, orderNumber: number });
  } catch (error) {
    console.error("PUBLIC ORDER POST ERROR", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "주문 처리에 실패했습니다." }, { status: 500 });
  }
}
