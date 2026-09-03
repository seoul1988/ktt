import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SQUARE_VERSION = "2026-08-19";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Supabase server configuration is missing.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function config() {
  const applicationId = process.env.SQUARE_APPLICATION_ID || "";
  const applicationSecret = process.env.SQUARE_APPLICATION_SECRET || "";
  const stateSecret = process.env.SQUARE_OAUTH_STATE_SECRET || applicationSecret;
  const sandbox = (process.env.SQUARE_ENVIRONMENT || "production").toLowerCase() === "sandbox";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.ktowntriangle.com";
  const redirectUri = process.env.SQUARE_REDIRECT_URI || `${siteUrl}/api/square/oauth/callback`;
  if (!applicationId || !applicationSecret || !stateSecret) throw new Error("Square OAuth config missing.");
  return { applicationId, applicationSecret, stateSecret, sandbox, siteUrl, redirectUri };
}

function verifyState(state: string, secret: string) {
  const dot = state.lastIndexOf(".");
  if (dot <= 0) throw new Error("INVALID_STATE");
  const payload = state.slice(0, dot);
  const signature = state.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("INVALID_STATE");
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!parsed?.businessId || !parsed?.userId || Number(parsed?.exp || 0) < Date.now()) throw new Error("INVALID_STATE");
  return parsed as { businessId: number; userId: string };
}

function redirectToMenu(siteUrl: string, businessId: number, status: string) {
  return NextResponse.redirect(`${siteUrl}/owner/business/${businessId}/menu?square=${encodeURIComponent(status)}`);
}

export async function GET(request: NextRequest) {
  const cfg = config();
  let businessId = 0;
  try {
    const code = request.nextUrl.searchParams.get("code") || "";
    const state = request.nextUrl.searchParams.get("state") || "";
    const errorParam = request.nextUrl.searchParams.get("error") || request.nextUrl.searchParams.get("error_description") || "";
    const stateData = verifyState(state, cfg.stateSecret);
    businessId = Number(stateData.businessId);

    if (errorParam || !code) return redirectToMenu(cfg.siteUrl, businessId, "cancelled");

    const base = cfg.sandbox ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
    const tokenResponse = await fetch(`${base}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Square-Version": SQUARE_VERSION },
      body: JSON.stringify({
        client_id: cfg.applicationId,
        client_secret: cfg.applicationSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: cfg.redirectUri,
      }),
      cache: "no-store",
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData?.access_token || !tokenData?.merchant_id) {
      console.error("SQUARE TOKEN ERROR", tokenData);
      return redirectToMenu(cfg.siteUrl, businessId, "error");
    }

    const accessToken = String(tokenData.access_token);
    const merchantId = String(tokenData.merchant_id);
    const apiBase = cfg.sandbox ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
    const squareHeaders = { Authorization: `Bearer ${accessToken}`, "Square-Version": SQUARE_VERSION, "Content-Type": "application/json" };

    const [merchantResponse, locationsResponse] = await Promise.all([
      fetch(`${apiBase}/v2/merchants/${encodeURIComponent(merchantId)}`, { headers: squareHeaders, cache: "no-store" }),
      fetch(`${apiBase}/v2/locations`, { headers: squareHeaders, cache: "no-store" }),
    ]);
    const merchantData = await merchantResponse.json().catch(() => ({}));
    const locationsData = await locationsResponse.json().catch(() => ({}));
    const locations = Array.isArray(locationsData?.locations) ? locationsData.locations : [];
    const location = locations.find((x: any) => x?.status === "ACTIVE") || locations[0];
    if (!location?.id) {
      console.error("SQUARE LOCATION ERROR", locationsData);
      return redirectToMenu(cfg.siteUrl, businessId, "no-location");
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("restaurant_order_private_settings").upsert({
      business_id: businessId,
      payment_provider: "square",
      square_merchant_id: merchantId,
      square_merchant_name: String(merchantData?.merchant?.business_name || merchantData?.merchant?.id || ""),
      square_location_id: String(location.id),
      square_location_name: String(location.name || location.business_name || ""),
      square_access_token: accessToken,
      square_refresh_token: String(tokenData.refresh_token || "") || null,
      square_token_expires_at: tokenData.expires_at || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "business_id" });
    if (error) throw error;

    return redirectToMenu(cfg.siteUrl, businessId, "connected");
  } catch (error) {
    console.error("SQUARE CALLBACK ERROR", error);
    if (businessId > 0) return redirectToMenu(cfg.siteUrl, businessId, "error");
    return NextResponse.redirect(`${cfg.siteUrl}/owner?square=error`);
  }
}
