import { createHmac, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("SERVER_CONFIG");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function bearer(request: NextRequest) {
  const value = request.headers.get("authorization") || "";
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : "";
}

function getSquareConfig() {
  const applicationId = process.env.SQUARE_APPLICATION_ID || "";
  const applicationSecret = process.env.SQUARE_APPLICATION_SECRET || "";
  const stateSecret = process.env.SQUARE_OAUTH_STATE_SECRET || applicationSecret;
  const environment = (process.env.SQUARE_ENVIRONMENT || "production").toLowerCase();
  const sandbox = environment === "sandbox";
  if (!applicationId) throw new Error("SQUARE_APPLICATION_ID_MISSING");
  if (!applicationSecret) throw new Error("SQUARE_APPLICATION_SECRET_MISSING");
  if (!stateSecret) throw new Error("SQUARE_STATE_SECRET_MISSING");
  if (environment !== "production") throw new Error("SQUARE_PRODUCTION_REQUIRED");
  if (applicationId.startsWith("sandbox-")) throw new Error("SQUARE_PRODUCTION_ID_MISMATCH");
  return { applicationId, stateSecret, sandbox };
}


function squareEnvDiagnostics() {
  const appIdRaw = process.env.SQUARE_APPLICATION_ID;
  const appSecretRaw = process.env.SQUARE_APPLICATION_SECRET;
  const stateSecretRaw = process.env.SQUARE_OAUTH_STATE_SECRET;
  const environmentRaw = process.env.SQUARE_ENVIRONMENT;
  const redirectRaw = process.env.SQUARE_REDIRECT_URI;

  const appId = (appIdRaw || "").trim();
  const appSecret = (appSecretRaw || "").trim();
  const stateSecret = (stateSecretRaw || "").trim();
  const environment = (environmentRaw || "").trim();
  const redirect = (redirectRaw || "").trim();

  return {
    squareApplicationId: appId ? "FOUND" : "MISSING",
    squareApplicationIdLength: appId.length,
    squareApplicationIdLooksSandbox: appId.startsWith("sandbox-"),
    squareApplicationSecret: appSecret ? "FOUND" : "MISSING",
    squareApplicationSecretLength: appSecret.length,
    squareOauthStateSecret: stateSecret ? "FOUND" : "NOT SET (Application Secret fallback will be used)",
    squareEnvironment: environment || "NOT SET",
    squareRedirectUri: redirect ? "FOUND" : "NOT SET",
    vercelEnv: process.env.VERCEL_ENV || "NOT SET",
    nodeEnv: process.env.NODE_ENV || "NOT SET",
  };
}

export async function GET() {
  // Diagnostics intentionally return only presence/status, never secret values.
  return NextResponse.json({
    ok: true,
    diagnostics: squareEnvDiagnostics(),
  });
}

function signState(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);
    if (!Number.isInteger(businessId) || businessId <= 0) return NextResponse.json({ error: "잘못된 비즈니스 ID입니다." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const token = bearer(request);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "admin") {
      const { data: owner } = await supabase.from("business_owners").select("status").eq("business_id", businessId).eq("user_id", user.id).maybeSingle();
      const ownerStatus = String(owner?.status || "").toLowerCase();
      if (!owner || !["approved", "active"].includes(ownerStatus)) return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    const { applicationId, stateSecret, sandbox } = getSquareConfig();
    const payload = Buffer.from(JSON.stringify({
      businessId,
      userId: user.id,
      exp: Date.now() + 10 * 60 * 1000,
      nonce: randomBytes(12).toString("hex"),
    })).toString("base64url");
    const state = `${payload}.${signState(payload, stateSecret)}`;

    const base = "https://connect.squareup.com";
    const redirectUri = process.env.SQUARE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.ktowntriangle.com"}/api/square/oauth/callback`;
    const url = new URL("/oauth2/authorize", base);
    url.searchParams.set("client_id", applicationId);
    url.searchParams.set(
      "scope",
      "MERCHANT_PROFILE_READ ORDERS_READ ORDERS_WRITE PAYMENTS_READ PAYMENTS_WRITE",
    );

    // Production OAuth should force the seller to explicitly choose/sign in
    // to the Square account they want to connect.
    url.searchParams.set("session", "false");

    url.searchParams.set("state", state);

    // The redirect URL is already registered in the Square Developer Console.
    // Keeping it here makes the callback explicit and must exactly match that value.
    url.searchParams.set("redirect_uri", redirectUri);

    return NextResponse.json({ authorizationUrl: url.toString() });
  } catch (error) {
    console.error("SQUARE CONNECT ERROR", error);
    const message = error instanceof Error ? error.message : "";
    const diagnostics = squareEnvDiagnostics();
    const diagText =
      `APP_ID=${diagnostics.squareApplicationId}, ` +
      `APP_SECRET=${diagnostics.squareApplicationSecret}, ` +
      `ENV=${diagnostics.squareEnvironment}, ` +
      `REDIRECT=${diagnostics.squareRedirectUri}, ` +
      `VERCEL_ENV=${diagnostics.vercelEnv}`;

    if (message === "SQUARE_PRODUCTION_REQUIRED") return NextResponse.json({
      error: `실제 상점주 연결용입니다. Vercel의 SQUARE_ENVIRONMENT 값을 production으로 바꾸세요. [${diagText}]`,
      diagnostics,
    }, { status: 500 });
    if (message === "SQUARE_APPLICATION_ID_MISSING") return NextResponse.json({
      error: `SQUARE_APPLICATION_ID를 서버가 읽지 못합니다. [${diagText}]`,
      diagnostics,
    }, { status: 500 });
    if (message === "SQUARE_APPLICATION_SECRET_MISSING") return NextResponse.json({
      error: `SQUARE_APPLICATION_SECRET을 서버가 읽지 못합니다. [${diagText}]`,
      diagnostics,
    }, { status: 500 });
    if (message === "SQUARE_STATE_SECRET_MISSING") return NextResponse.json({
      error: `SQUARE_OAUTH_STATE_SECRET 또는 Application Secret이 필요합니다. [${diagText}]`,
      diagnostics,
    }, { status: 500 });
    if (message === "SQUARE_SANDBOX_ID_MISMATCH") return NextResponse.json({
      error: `SQUARE_ENVIRONMENT=sandbox인데 Application ID가 Sandbox ID가 아닙니다. [${diagText}]`,
      diagnostics,
    }, { status: 500 });
    if (message === "SQUARE_PRODUCTION_ID_MISMATCH") return NextResponse.json({
      error: `Sandbox Application ID를 사용 중입니다. SQUARE_ENVIRONMENT=sandbox가 필요합니다. [${diagText}]`,
      diagnostics,
    }, { status: 500 });
    return NextResponse.json({
      error: `${message || "Square 연결을 시작하지 못했습니다."} [${diagText}]`,
      diagnostics,
    }, { status: 500 });
  }
}
