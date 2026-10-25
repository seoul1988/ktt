import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createCipheriv, hkdfSync, randomBytes } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// NEW FILE: app/api/owner/business/[id]/sms-settings/route.ts
// Run sms_settings.sql once before deploying this route.
// Tokens are encrypted with AES-256-GCM. Keep the encryption secret stable.
// Optional TWILIO_SETTINGS_ENCRYPTION_SECRET overrides the existing service-role
// secret. Changing either active encryption secret requires token re-entry or
// migration before enabling SMS. This route stores configuration, not env vars.

function adminClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase server environment variables are missing.",
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function requireAccess(
  request: Request,
  businessId: number,
) {
  const auth =
    request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ")
    ? auth.slice(7).trim()
    : "";

  if (!token) {
    return {
      ok: false as const,
      status: 401,
      error: "로그인이 필요합니다.",
    };
  }

  const supabase = adminClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return {
      ok: false as const,
      status: 401,
      error: "로그인 세션이 올바르지 않습니다.",
    };
  }

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError) throw profileError;

  if (
    String(profile?.role || "").toLowerCase() ===
    "admin"
  ) {
    return { ok: true as const, supabase };
  }

  const { data: owner, error: ownerError } =
    await supabase
      .from("business_owners")
      .select("business_id,status")
      .eq("business_id", businessId)
      .eq("user_id", user.id)
      .maybeSingle();

  if (ownerError) throw ownerError;

  // Existing KTown owner records may have approved/active status.
  const status = String(
    owner?.status || "",
  ).toLowerCase();

  if (
    !owner ||
    !["approved", "active"].includes(status)
  ) {
    return {
      ok: false as const,
      status: 403,
      error:
        "이 비즈니스를 관리할 권한이 없습니다.",
    };
  }

  return { ok: true as const, supabase };
}


type Context = { params: Promise<{ id: string }> };
const CONFIG_COLUMNS = "account_sid,from_number,messaging_service_sid,auth_token_encrypted,sms_requested,updated_at";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, private, max-age=0" } });
}

function encryptToken(token: string, businessId: number) {
  const secret = process.env.TWILIO_SETTINGS_ENCRYPTION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Missing encryption secret");
  const key = Buffer.from(hkdfSync("sha256", secret, "ktown-twilio-settings-v1", "auth-token", 32));
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(String(businessId)));
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(":");
}

function metadata(row: any) {
  return {
    accountSid: String(row?.account_sid || ""),
    fromNumber: String(row?.from_number || ""),
    messagingServiceSid: String(row?.messaging_service_sid || ""),
    hasAuthToken: Boolean(row?.auth_token_encrypted),
    requested: row?.sms_requested === true,
  };
}

function failure(error: unknown) {
  // Do not echo/log request bodies, database details or credential values.
  const code = typeof error === "object" && error ? String((error as { code?: unknown }).code || "") : "";
  if (["42P01", "42703", "42883", "PGRST202", "PGRST204", "PGRST205"].includes(code)) {
    return json({ error: "SMS 저장 테이블이 준비되지 않았습니다. sms_settings.sql을 먼저 실행하세요." }, 503);
  }
  if (code === "40001") return json({ error: "다른 창에서 설정이 변경되었습니다. 창을 다시 열어 수정하세요." }, 409);
  if (code === "22023") return json({ error: "Account SID를 변경할 때에는 새 Auth Token도 입력하세요." }, 400);
  return json({ error: "SMS 설정 처리에 실패했습니다. 잠시 후 다시 시도하세요." }, 500);
}

async function authorize(request: Request, context: Context) {
  const { id } = await context.params;
  const businessId = Number(id);
  if (!Number.isSafeInteger(businessId) || businessId <= 0) return { ok: false as const, response: json({ error: "잘못된 비즈니스 ID입니다." }, 400) };
  const access = await requireAccess(request, businessId);
  if (!access.ok) return { ok: false as const, response: json({ error: access.error }, access.status) };
  const { data, error } = await access.supabase.from("businesses").select("id").eq("id", businessId).maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false as const, response: json({ error: "비즈니스를 찾지 못했습니다." }, 404) };
  return { ok: true as const, businessId, supabase: access.supabase };
}

export async function GET(request: Request, context: Context) {
  try {
    const auth = await authorize(request, context);
    if (!auth.ok) return auth.response;
    const { data: row, error } = await auth.supabase.from("restaurant_sms_private_settings").select(CONFIG_COLUMNS).eq("business_id", auth.businessId).maybeSingle();
    if (error) throw error;
    const { data: settings, error: settingsError } = await auth.supabase.from("restaurant_order_settings").select("sms_enabled").eq("business_id", auth.businessId).maybeSingle();
    if (settingsError) throw settingsError;
    return json({ twilioSettings: metadata(row), smsEnabled: settings?.sms_enabled === true });
  } catch (error) { return failure(error); }
}

export async function PUT(request: Request, context: Context) {
  try {
    const auth = await authorize(request, context);
    if (!auth.ok) return auth.response;
    let body: any;
    try { body = await request.json(); } catch { return json({ error: "올바른 JSON 요청이 필요합니다." }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "입력값이 올바르지 않습니다." }, 400);
    if (Object.keys(body).some((key) => !["accountSid", "authToken", "fromNumber", "messagingServiceSid", "smsEnabled"].includes(key))) return json({ error: "지원하지 않는 설정 항목입니다." }, 400);
    for (const key of ["accountSid", "authToken", "fromNumber", "messagingServiceSid"]) {
      if (body[key] !== undefined && (typeof body[key] !== "string" || body[key].length > 256)) return json({ error: "입력값 형식이 올바르지 않습니다." }, 400);
    }
    if (body.smsEnabled !== undefined && typeof body.smsEnabled !== "boolean") return json({ error: "SMS 사용 설정이 올바르지 않습니다." }, 400);
    const accountSid = String(body.accountSid || "").trim();
    const token = String(body.authToken || "").trim();
    const fromNumber = String(body.fromNumber || "").trim();
    const serviceSid = String(body.messagingServiceSid || "").trim();
    if (accountSid && !/^AC[0-9a-f]{32}$/i.test(accountSid)) return json({ error: "Account SID 형식이 올바르지 않습니다." }, 400);
    if (token && !/^[0-9a-f]{32}$/i.test(token)) return json({ error: "Auth Token 형식이 올바르지 않습니다." }, 400);
    if (fromNumber && !/^\+[1-9]\d{7,14}$/.test(fromNumber)) return json({ error: "발신번호는 +1 등을 포함한 국제번호로 입력하세요." }, 400);
    if (serviceSid && !/^MG[0-9a-f]{32}$/i.test(serviceSid)) return json({ error: "Messaging Service SID 형식이 올바르지 않습니다." }, 400);
    const { data: current, error: readError } = await auth.supabase.from("restaurant_sms_private_settings").select(CONFIG_COLUMNS).eq("business_id", auth.businessId).maybeSingle();
    if (readError) throw readError;
    // Partial / empty credentials are valid drafts. A blank token preserves the
    // encrypted value. Reject account changes that would reuse another account's token.
    if (current?.auth_token_encrypted && accountSid !== current.account_sid && !token) return json({ error: "Account SID를 변경할 때에는 새 Auth Token도 입력하세요." }, 400);
    const encryptedToken = token ? encryptToken(token, auth.businessId) : null;
    const { data: saved, error: saveError } = await auth.supabase.rpc("save_restaurant_sms_settings_v1", {
      p_business_id: auth.businessId,
      p_account_sid: accountSid,
      p_from_number: fromNumber,
      p_messaging_service_sid: serviceSid,
      p_auth_token_encrypted: encryptedToken,
      p_sms_requested: body.smsEnabled === true,
      p_expected_updated_at: current?.updated_at || null,
    });
    if (saveError) throw saveError;
    if (!saved || typeof saved.smsEnabled !== "boolean" || !saved.twilioSettings) throw new Error("Invalid save response");
    return json({ success: true, ...saved });
  } catch (error) { return failure(error); }
}
