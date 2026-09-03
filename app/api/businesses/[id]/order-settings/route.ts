import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase server environment variables are missing.");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeTaxRate(value: unknown) {
  const rate = Number(value);
  if (!Number.isFinite(rate)) return 0;
  return Math.max(0, Math.min(1, rate));
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);

    if (!Number.isInteger(businessId) || businessId <= 0) {
      return NextResponse.json({ error: "Invalid business id" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const [
      { data: business, error: businessError },
      { data: settings, error: settingsError },
      { data: privateSettings, error: privateError },
    ] = await Promise.all([
      supabase
        .from("businesses")
        .select(
          "id,name,restaurant_menu_menu_enabled,restaurant_menu_pickup_enabled,restaurant_menu_delivery_enabled",
        )
        .eq("id", businessId)
        .maybeSingle(),
      supabase
        .from("restaurant_order_settings")
        .select(
          "pickup_enabled,delivery_enabled,pay_at_pickup_enabled,sms_enabled,pickup_prep_minutes,delivery_prep_minutes,tax_rate,tip_presets",
        )
        .eq("business_id", businessId)
        .maybeSingle(),
      supabase
        .from("restaurant_order_private_settings")
        .select("payment_provider,stripe_secret_key,square_access_token,square_location_id")
        .eq("business_id", businessId)
        .maybeSingle(),
    ]);

    if (businessError) throw businessError;
    if (settingsError) throw settingsError;
    if (privateError) throw privateError;

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    let menu = business.restaurant_menu_menu_enabled !== false;
    let pickup = business.restaurant_menu_pickup_enabled === true;
    let delivery = business.restaurant_menu_delivery_enabled === true;

    if (!menu && !pickup && !delivery) {
      menu = true;
      pickup = false;
      delivery = false;
    }

    const paymentProvider =
      privateSettings?.payment_provider === "square" ? "square" : "stripe";

    const onlinePaymentEnabled =
      paymentProvider === "square"
        ? Boolean(
            privateSettings?.square_access_token &&
              privateSettings?.square_location_id,
          )
        : Boolean(privateSettings?.stripe_secret_key);

    const tipPresets = Array.isArray(settings?.tip_presets)
      ? settings.tip_presets
          .map((value: unknown) => Number(value))
          .filter((value: number) => Number.isFinite(value) && value >= 0 && value <= 100)
      : [15, 18, 20];

    return NextResponse.json(
      {
        businessId,
        businessName: business.name || "Restaurant",

        orderModes: { menu, pickup, delivery },

        pickupEnabled: pickup,
        deliveryEnabled: delivery,

        paymentProvider,
        onlinePaymentEnabled,
        payAtPickupEnabled: settings?.pay_at_pickup_enabled !== false,
        smsEnabled: settings?.sms_enabled === true,

        pickupPrepMinutes: Math.max(
          0,
          Number(settings?.pickup_prep_minutes ?? 20) || 20,
        ),
        deliveryPrepMinutes: Math.max(
          0,
          Number(settings?.delivery_prep_minutes ?? 45) || 45,
        ),

        taxRate: normalizeTaxRate(settings?.tax_rate),
        tipPresets,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Order settings load failed",
      },
      { status: 500 },
    );
  }
}
