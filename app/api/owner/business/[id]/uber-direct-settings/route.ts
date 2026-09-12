import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase server environment variables are missing.");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireAccess(request: Request, businessId: number) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

  if (!token) {
    return { ok: false as const, status: 401, error: "로그인이 필요합니다." };
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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) throw profileError;

  if (String(profile?.role || "").toLowerCase() === "admin") {
    return { ok: true as const, supabase };
  }

  const { data: owner, error: ownerError } = await supabase
    .from("business_owners")
    .select("business_id,status")
    .eq("business_id", businessId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (ownerError) throw ownerError;

  const status = String(owner?.status || "").toLowerCase();
  if (!owner || !["approved", "active"].includes(status)) {
    return {
      ok: false as const,
      status: 403,
      error: "이 비즈니스를 관리할 권한이 없습니다.",
    };
  }

  return { ok: true as const, supabase };
}

function mask(value: unknown, visible = 4) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= visible * 2) return "••••••••";
  return `${text.slice(0, visible)}••••••••${text.slice(-visible)}`;
}

function responseShape(row: any) {
  const clientId = String(row?.uber_direct_client_id || "").trim();
  const clientSecret = String(row?.uber_direct_client_secret || "").trim();
  const customerId = String(row?.uber_direct_customer_id || "").trim();
  const webhookKey = String(row?.uber_direct_webhook_signing_key || "").trim();

  return {
    uberDirectEnabled:
      row?.delivery_provider === "uber_direct" && row?.uber_direct_enabled === true,
    uberDirectConfigured: Boolean(clientId && clientSecret && customerId),
    uberClientIdMasked: mask(clientId),
    uberCustomerIdMasked: mask(customerId),
    uberClientSecretConfigured: Boolean(clientSecret),
    uberWebhookSigningKeyConfigured: Boolean(webhookKey),
  };
}

function jsonError(error: unknown, fallback: string, status = 500) {
  const message = error instanceof Error ? error.message : fallback;
  console.error("[owner uber-direct-settings]", error);
  return NextResponse.json({ error: message }, { status });
}

async function loadRow(supabase: any, businessId: number) {
  const { data, error } = await supabase
    .from("restaurant_order_private_settings")
    .select(
      "business_id,delivery_provider,uber_direct_enabled,uber_direct_client_id,uber_direct_client_secret,uber_direct_customer_id,uber_direct_webhook_signing_key",
    )
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Secret 원문은 절대 응답하지 않고 SHA-256 지문만 반환합니다.
 * PowerShell / Supabase에서 계산한 SHA-256과 비교하면
 * 실제 Vercel 서버가 어느 Secret을 읽고 있는지 확인할 수 있습니다.
 */
function credentialDebug(
  businessId: number,
  clientId: string,
  clientSecret: string,
  customerId: string,
) {
  return {
    businessId,
    clientIdMasked: mask(clientId),
    clientIdLength: clientId.length,
    clientSecretLength: clientSecret.length,
    clientSecretSha256: createHash("sha256")
      .update(clientSecret, "utf8")
      .digest("hex"),
    customerIdMasked: mask(customerId),
    customerIdLength: customerId.length,
    authUrl: "https://auth.uber.com/oauth/v2/token",
    scope: "eats.deliveries",
  };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);

    if (!Number.isInteger(businessId) || businessId <= 0) {
      return NextResponse.json(
        { error: "잘못된 비즈니스 ID입니다." },
        { status: 400 },
      );
    }

    const access = await requireAccess(request, businessId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const row = await loadRow(access.supabase, businessId);
    return NextResponse.json(responseShape(row));
  } catch (error) {
    return jsonError(error, "Uber Direct 설정을 불러오지 못했습니다.");
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);

    if (!Number.isInteger(businessId) || businessId <= 0) {
      return NextResponse.json(
        { error: "잘못된 비즈니스 ID입니다." },
        { status: 400 },
      );
    }

    const access = await requireAccess(request, businessId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const body = await request.json().catch(() => ({}));
    const current = (await loadRow(access.supabase, businessId)) || {};

    const clientId = String(body?.clientId || "").trim();
    const clientSecret = String(body?.clientSecret || "").trim();
    const customerId = String(body?.customerId || "").trim();
    const webhookSigningKey = String(body?.webhookSigningKey || "").trim();
    const enabled = body?.enabled === true;

    // 입력칸을 비운 채 저장해도 기존 값을 유지합니다.
    const nextClientId =
      clientId || String(current?.uber_direct_client_id || "").trim();
    const nextClientSecret =
      clientSecret || String(current?.uber_direct_client_secret || "").trim();
    const nextCustomerId =
      customerId || String(current?.uber_direct_customer_id || "").trim();
    const nextWebhookSigningKey =
      webhookSigningKey ||
      String(current?.uber_direct_webhook_signing_key || "").trim();

    if (enabled && (!nextClientId || !nextClientSecret || !nextCustomerId)) {
      return NextResponse.json(
        {
          error:
            "Uber Direct를 켜려면 Client ID, Client Secret, Customer ID를 모두 저장해야 합니다.",
        },
        { status: 400 },
      );
    }

    const payload = {
      business_id: businessId,
      delivery_provider: enabled ? "uber_direct" : "manual",
      uber_direct_enabled: enabled,
      uber_direct_client_id: nextClientId || null,
      uber_direct_client_secret: nextClientSecret || null,
      uber_direct_customer_id: nextCustomerId || null,
      uber_direct_webhook_signing_key: nextWebhookSigningKey || null,
    };

    const { data, error } = await access.supabase
      .from("restaurant_order_private_settings")
      .upsert(payload, { onConflict: "business_id" })
      .select(
        "business_id,delivery_provider,uber_direct_enabled,uber_direct_client_id,uber_direct_client_secret,uber_direct_customer_id,uber_direct_webhook_signing_key",
      )
      .single();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      ...responseShape(data),
    });
  } catch (error) {
    return jsonError(error, "Uber Direct 설정 저장에 실패했습니다.");
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);

    if (!Number.isInteger(businessId) || businessId <= 0) {
      return NextResponse.json(
        { error: "잘못된 비즈니스 ID입니다." },
        { status: 400 },
      );
    }

    const access = await requireAccess(request, businessId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const body = await request.json().catch(() => ({}));
    if (body?.action !== "test") {
      return NextResponse.json(
        { error: "지원하지 않는 요청입니다." },
        { status: 400 },
      );
    }

    // 연결 테스트는 반드시 DB에 저장된 식당별 자격증명을 사용합니다.
    const row = await loadRow(access.supabase, businessId);
    const clientId = String(row?.uber_direct_client_id || "").trim();
    const clientSecret = String(row?.uber_direct_client_secret || "").trim();
    const customerId = String(row?.uber_direct_customer_id || "").trim();

    if (!clientId || !clientSecret || !customerId) {
      return NextResponse.json(
        { error: "먼저 Uber Direct 계정 정보를 저장하세요." },
        { status: 400 },
      );
    }

    const debug = credentialDebug(
      businessId,
      clientId,
      clientSecret,
      customerId,
    );

    const tokenResponse = await fetch(
      "https://auth.uber.com/oauth/v2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "client_credentials",
          scope: "eats.deliveries",
        }),
        cache: "no-store",
      },
    );

    const tokenPayload = await tokenResponse.json().catch(() => ({}));

    if (!tokenResponse.ok || !tokenPayload?.access_token) {
      const uberMessage =
        tokenPayload?.error_description ||
        tokenPayload?.error ||
        `Uber 인증 실패 (HTTP ${tokenResponse.status})`;

      console.error("[owner uber-direct-settings] Uber auth failed", {
        status: tokenResponse.status,
        uberError: tokenPayload?.error || null,
        uberErrorDescription: tokenPayload?.error_description || null,
        debug,
      });

      return NextResponse.json(
        {
          error: uberMessage,
          uberStatus: tokenResponse.status,
          uberError: tokenPayload?.error || null,
          debug,
        },
        { status: 400 },
      );
    }

    // 성공했을 때도 동일한 지문을 반환하므로
    // 실제 배포 서버가 올바른 DB 값을 읽는지 확인할 수 있습니다.
    return NextResponse.json({
      ok: true,
      authenticated: true,
      customerIdMasked: mask(customerId),
      debug,
    });
  } catch (error) {
    return jsonError(error, "Uber Direct 연결 확인에 실패했습니다.");
  }
}
