import { NextResponse } from "next/server";
import { getOrderAdmin } from "@/lib/restaurant-order/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);
    if (!Number.isInteger(businessId) || businessId <= 0) return NextResponse.json({ error: "Invalid business id" }, { status: 400 });
    const db = getOrderAdmin();
    const [{ data: business, error: businessError }, { data: settings, error: settingsError }, { data: privateSettings }] = await Promise.all([
      db.from("businesses").select("id,name").eq("id", businessId).maybeSingle(),
      db.from("restaurant_order_settings").select("pickup_enabled,delivery_enabled,pay_at_pickup_enabled,sms_enabled,pickup_prep_minutes,delivery_prep_minutes,tax_rate,tip_presets").eq("business_id", businessId).maybeSingle(),
      db.from("restaurant_order_private_settings").select("stripe_secret_key").eq("business_id", businessId).maybeSingle(),
    ]);
    if (businessError) throw businessError;
    if (settingsError) throw settingsError;
    if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });
    return NextResponse.json({
      businessId,
      businessName: business.name || "Restaurant",
      pickupEnabled: settings?.pickup_enabled !== false,
      deliveryEnabled: settings?.delivery_enabled === true,
      onlinePaymentEnabled: Boolean(privateSettings?.stripe_secret_key),
      payAtPickupEnabled: settings?.pay_at_pickup_enabled !== false,
      smsEnabled: settings?.sms_enabled === true,
      pickupPrepMinutes: Number(settings?.pickup_prep_minutes || 20),
      deliveryPrepMinutes: Number(settings?.delivery_prep_minutes || 45),
      taxRate: Number(settings?.tax_rate || 0),
      tipPresets: Array.isArray(settings?.tip_presets) ? settings.tip_presets : [15, 18, 20],
    });
  } catch (error) {
    console.error("PUBLIC ORDER SETTINGS GET ERROR", error);
    return NextResponse.json({ error: "주문 설정을 불러오지 못했습니다." }, { status: 500 });
  }
}
