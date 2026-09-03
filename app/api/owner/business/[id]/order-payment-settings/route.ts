import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !serviceRoleKey) throw new Error("Supabase server configuration is missing.");
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getBearerToken(request: NextRequest) {
  const value = request.headers.get("authorization") || "";
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : "";
}

async function requireBusinessAccess(request: NextRequest, businessId: number) {
  const supabase = getSupabaseAdmin();
  const token = getBearerToken(request);
  if (!token) throw new Error("UNAUTHORIZED");

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) throw new Error("UNAUTHORIZED");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role === "admin") return { supabase, user };

  const { data: owner } = await supabase
    .from("business_owners")
    .select("business_id,status")
    .eq("business_id", businessId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!owner || owner.status !== "approved") throw new Error("FORBIDDEN");
  return { supabase, user };
}

function maskSecret(value: unknown, visibleEnd = 4) {
  const text = String(value || "").trim();
  if (!text) return "";
  const prefix = text.startsWith("sk_test_") ? "sk_test_" : text.startsWith("sk_live_") ? "sk_live_" : text.startsWith("whsec_") ? "whsec_" : "";
  return `${prefix}••••${text.slice(-visibleEnd)}`;
}

function buildResponse(row: any) {
  const stripeSecretKey = String(row?.stripe_secret_key || "").trim();
  const stripeWebhookSecret = String(row?.stripe_webhook_secret || "").trim();
  const squareAccessToken = String(row?.square_access_token || "").trim();
  const squareMerchantId = String(row?.square_merchant_id || "").trim();
  const squareLocationId = String(row?.square_location_id || "").trim();

  return {
    paymentProvider: row?.payment_provider === "square" ? "square" : "stripe",
    stripeConfigured: Boolean(stripeSecretKey),
    stripeWebhookConfigured: Boolean(stripeWebhookSecret),
    stripeSecretKeyMasked: maskSecret(stripeSecretKey),
    stripeWebhookSecretMasked: maskSecret(stripeWebhookSecret),
    squareConfigured: Boolean(squareAccessToken && squareMerchantId && squareLocationId),
    squareMerchantId,
    squareMerchantName: String(row?.square_merchant_name || ""),
    squareLocationId,
    squareLocationName: String(row?.square_location_name || ""),
  };
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  if (message === "UNAUTHORIZED") return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (message === "FORBIDDEN") return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
  console.error("ORDER PAYMENT SETTINGS ERROR", error);
  return NextResponse.json({ error: "결제 계정 설정 처리 중 오류가 발생했습니다." }, { status: 500 });
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);
    if (!Number.isInteger(businessId) || businessId <= 0) {
      return NextResponse.json({ error: "잘못된 비즈니스 ID입니다." }, { status: 400 });
    }

    const { supabase } = await requireBusinessAccess(request, businessId);
    const { data, error } = await supabase
      .from("restaurant_order_private_settings")
      .select("payment_provider,stripe_secret_key,stripe_webhook_secret,square_access_token,square_merchant_id,square_merchant_name,square_location_id,square_location_name")
      .eq("business_id", businessId)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json(buildResponse(data));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);
    if (!Number.isInteger(businessId) || businessId <= 0) {
      return NextResponse.json({ error: "잘못된 비즈니스 ID입니다." }, { status: 400 });
    }

    const { supabase } = await requireBusinessAccess(request, businessId);
    const body = await request.json();

    // Square credentials are never accepted from the browser anymore.
    if (body?.paymentProvider === "square") {
      const { data, error } = await supabase
        .from("restaurant_order_private_settings")
        .upsert({ business_id: businessId, payment_provider: "square", updated_at: new Date().toISOString() }, { onConflict: "business_id" })
        .select("payment_provider,stripe_secret_key,stripe_webhook_secret,square_access_token,square_merchant_id,square_merchant_name,square_location_id,square_location_name")
        .single();
      if (error) throw error;
      return NextResponse.json(buildResponse(data));
    }

    const { data: existing, error: readError } = await supabase
      .from("restaurant_order_private_settings")
      .select("stripe_secret_key,stripe_webhook_secret")
      .eq("business_id", businessId)
      .maybeSingle();
    if (readError) throw readError;

    const stripeSecretKeyInput = String(body?.stripeSecretKey || "").trim();
    const stripeWebhookSecretInput = String(body?.stripeWebhookSecret || "").trim();

    if (stripeSecretKeyInput && !(stripeSecretKeyInput.startsWith("sk_test_") || stripeSecretKeyInput.startsWith("sk_live_"))) {
      return NextResponse.json({ error: "Stripe Secret Key 형식을 확인하세요." }, { status: 400 });
    }
    if (stripeWebhookSecretInput && !stripeWebhookSecretInput.startsWith("whsec_")) {
      return NextResponse.json({ error: "Stripe Webhook Secret 형식을 확인하세요." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("restaurant_order_private_settings")
      .upsert({
        business_id: businessId,
        payment_provider: "stripe",
        stripe_secret_key: stripeSecretKeyInput || existing?.stripe_secret_key || null,
        stripe_webhook_secret: stripeWebhookSecretInput || existing?.stripe_webhook_secret || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "business_id" })
      .select("payment_provider,stripe_secret_key,stripe_webhook_secret,square_access_token,square_merchant_id,square_merchant_name,square_location_id,square_location_name")
      .single();
    if (error) throw error;
    return NextResponse.json(buildResponse(data));
  } catch (error) {
    return errorResponse(error);
  }
}
