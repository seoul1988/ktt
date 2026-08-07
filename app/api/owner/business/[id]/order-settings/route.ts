import { NextResponse } from "next/server";
import { getOrderAdmin, requireOrderOwner } from "@/lib/restaurant-order/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const businessId = Number((await context.params).id);
    const access = await requireOrderOwner(request, businessId);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    const db = getOrderAdmin();
    const [{ data: business }, { data: s }, { data: p }] = await Promise.all([
      db.from("businesses").select("id,name").eq("id", businessId).single(),
      db.from("restaurant_order_settings").select("*").eq("business_id", businessId).maybeSingle(),
      db.from("restaurant_order_private_settings").select("twilio_account_sid,twilio_auth_token,twilio_phone_number,stripe_secret_key,stripe_webhook_secret").eq("business_id", businessId).maybeSingle(),
    ]);
    return NextResponse.json({
      business,
      settings: {
        pickupEnabled: s?.pickup_enabled !== false,
        deliveryEnabled: s?.delivery_enabled === true,
        payAtPickupEnabled: s?.pay_at_pickup_enabled !== false,
        smsEnabled: s?.sms_enabled === true,
        pickupPrepMinutes: Number(s?.pickup_prep_minutes || 20),
        deliveryPrepMinutes: Number(s?.delivery_prep_minutes || 45),
        taxRatePercent: Number(s?.tax_rate || 0) * 100,
        tipPresets: Array.isArray(s?.tip_presets) ? s.tip_presets : [15,18,20],
        twilioAccountSid: p?.twilio_account_sid || "",
        twilioAuthToken: p?.twilio_auth_token ? "••••••••" : "",
        twilioPhoneNumber: p?.twilio_phone_number || "",
        stripeSecretKey: p?.stripe_secret_key ? "••••••••" : "",
        stripeWebhookSecret: p?.stripe_webhook_secret ? "••••••••" : "",
      },
    });
  } catch (e) {
    console.error(e); return NextResponse.json({ error: "설정을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const businessId = Number((await context.params).id);
    const access = await requireOrderOwner(request, businessId);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    const body = await request.json();
    const db = getOrderAdmin();
    const publicRow = {
      business_id: businessId,
      pickup_enabled: body.pickupEnabled !== false,
      delivery_enabled: body.deliveryEnabled === true,
      pay_at_pickup_enabled: body.payAtPickupEnabled !== false,
      sms_enabled: body.smsEnabled === true,
      pickup_prep_minutes: Math.max(0, Number(body.pickupPrepMinutes || 20)),
      delivery_prep_minutes: Math.max(0, Number(body.deliveryPrepMinutes || 45)),
      tax_rate: Math.max(0, Number(body.taxRatePercent || 0)) / 100,
      tip_presets: Array.isArray(body.tipPresets) ? body.tipPresets.map(Number).filter(Number.isFinite).slice(0, 6) : [15,18,20],
      updated_at: new Date().toISOString(),
    };
    const { error: e1 } = await db.from("restaurant_order_settings").upsert(publicRow, { onConflict: "business_id" });
    if (e1) throw e1;

    const current = await db.from("restaurant_order_private_settings").select("*").eq("business_id", businessId).maybeSingle();
    const old = current.data || {};
    const keep = (incoming: unknown, oldValue: string | null | undefined) => {
      const v = String(incoming || "").trim();
      return v === "••••••••" ? (oldValue || null) : (v || null);
    };
    const privateRow = {
      business_id: businessId,
      twilio_account_sid: String(body.twilioAccountSid || "").trim() || null,
      twilio_auth_token: keep(body.twilioAuthToken, old.twilio_auth_token),
      twilio_phone_number: String(body.twilioPhoneNumber || "").trim() || null,
      stripe_secret_key: keep(body.stripeSecretKey, old.stripe_secret_key),
      stripe_webhook_secret: keep(body.stripeWebhookSecret, old.stripe_webhook_secret),
      updated_at: new Date().toISOString(),
    };
    const { error: e2 } = await db.from("restaurant_order_private_settings").upsert(privateRow, { onConflict: "business_id" });
    if (e2) throw e2;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e); return NextResponse.json({ error: "설정 저장에 실패했습니다." }, { status: 500 });
  }
}
