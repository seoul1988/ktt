import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DOORDASH_BASE_URL = "https://openapi.doordash.com";

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

function base64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createDoorDashJwt() {
  const developerId = String(process.env.DOORDASH_DEVELOPER_ID || "").trim();
  const keyId = String(process.env.DOORDASH_KEY_ID || "").trim();
  const signingSecret = String(process.env.DOORDASH_SIGNING_SECRET || "").trim();

 if (!developerId || !keyId || !signingSecret) {
  throw new Error(
    `DoorDash ENV 확인: ` +
      `DEVELOPER_ID=${developerId ? "OK" : "MISSING"}, ` +
      `KEY_ID=${keyId ? "OK" : "MISSING"}, ` +
      `SIGNING_SECRET=${signingSecret ? "OK" : "MISSING"}`
  );
}

  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "HS256",
    typ: "JWT",
    "dd-ver": "DD-JWT-V1",
  };
  const payload = {
    aud: "doordash",
    iss: developerId,
    kid: keyId,
    iat: now,
    exp: now + 300,
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(
    JSON.stringify(payload),
  )}`;

  let secret: Buffer;
  try {
    secret = Buffer.from(signingSecret, "base64");
    if (!secret.length) throw new Error("empty");
  } catch {
    throw new Error("DOORDASH_SIGNING_SECRET 형식을 확인하세요.");
  }

  const signature = crypto
    .createHmac("sha256", secret)
    .update(unsigned)
    .digest();

  return `${unsigned}.${base64url(signature)}`;
}

async function ddFetch(path: string, init?: RequestInit) {
  const token = createDoorDashJwt();
  const response = await fetch(`${DOORDASH_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function businessAddress(row: any) {
  const direct = firstText(row?.full_address, row?.formatted_address);
  if (direct) return direct;

  const street = firstText(row?.address, row?.address1, row?.street_address);
  const city = firstText(row?.city);
  const state = firstText(row?.state, row?.state_code, row?.region);
  const zip = firstText(row?.zip, row?.zipcode, row?.postal_code);

  return [street, city, state, zip].filter(Boolean).join(", ");
}

function usPhone(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("+") && /^\+\d{10,15}$/.test(raw.replace(/\s/g, ""))) {
    return raw.replace(/\s/g, "");
  }

  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return raw;
}

function errorMessage(payload: any, fallback: string) {
  return firstText(
    payload?.message,
    payload?.error,
    payload?.detail,
    payload?.field_errors?.[0]?.error,
    fallback,
  );
}

async function ensureBusiness(args: {
  externalBusinessId: string;
  name: string;
}) {
  const path = `/developer/v1/businesses/${encodeURIComponent(
    args.externalBusinessId,
  )}`;

  const existing = await ddFetch(path, { method: "GET" });
  if (existing.response.ok) {
    const patched = await ddFetch(path, {
      method: "PATCH",
      body: JSON.stringify({
        name: args.name,
        description: "KTown Triangle restaurant delivery",
        activation_status: "active",
      }),
    });

    if (!patched.response.ok) {
      throw new Error(
        errorMessage(
          patched.payload,
          `DoorDash Business 업데이트 실패 (HTTP ${patched.response.status})`,
        ),
      );
    }
    return patched.payload;
  }

  if (existing.response.status !== 404) {
    throw new Error(
      errorMessage(
        existing.payload,
        `DoorDash Business 조회 실패 (HTTP ${existing.response.status})`,
      ),
    );
  }

  const created = await ddFetch("/developer/v1/businesses", {
    method: "POST",
    body: JSON.stringify({
      external_business_id: args.externalBusinessId,
      name: args.name,
      description: "KTown Triangle restaurant delivery",
      activation_status: "active",
    }),
  });

  if (!created.response.ok) {
    throw new Error(
      errorMessage(
        created.payload,
        `DoorDash Business 생성 실패 (HTTP ${created.response.status})`,
      ),
    );
  }

  return created.payload;
}

async function ensureStore(args: {
  externalBusinessId: string;
  externalStoreId: string;
  name: string;
  phone: string;
  address: string;
}) {
  const basePath = `/developer/v1/businesses/${encodeURIComponent(
    args.externalBusinessId,
  )}/stores`;
  const itemPath = `${basePath}/${encodeURIComponent(args.externalStoreId)}`;

  const existing = await ddFetch(itemPath, { method: "GET" });
  const storeBody = {
    name: args.name,
    phone_number: args.phone,
    address: args.address,
  };

  if (existing.response.ok) {
    const patched = await ddFetch(itemPath, {
      method: "PATCH",
      body: JSON.stringify(storeBody),
    });

    if (!patched.response.ok) {
      throw new Error(
        errorMessage(
          patched.payload,
          `DoorDash Store 업데이트 실패 (HTTP ${patched.response.status})`,
        ),
      );
    }
    return patched.payload;
  }

  if (existing.response.status !== 404) {
    throw new Error(
      errorMessage(
        existing.payload,
        `DoorDash Store 조회 실패 (HTTP ${existing.response.status})`,
      ),
    );
  }

  const created = await ddFetch(basePath, {
    method: "POST",
    body: JSON.stringify({
      external_store_id: args.externalStoreId,
      ...storeBody,
    }),
  });

  if (!created.response.ok) {
    throw new Error(
      errorMessage(
        created.payload,
        `DoorDash Store 생성 실패 (HTTP ${created.response.status})`,
      ),
    );
  }

  return created.payload;
}

function jsonError(error: unknown, fallback: string, status = 500) {
  const message = error instanceof Error ? error.message : fallback;
  console.error("[owner doordash connect]", error);
  return NextResponse.json({ error: message }, { status });
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

    const { data: business, error: businessError } = await access.supabase
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .maybeSingle();

    if (businessError) throw businessError;
    if (!business) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }

    const name = firstText(business?.name, `KTown Business ${businessId}`);
    const address = businessAddress(business);
    const phone = usPhone(
      firstText(business?.phone, business?.phone_number, business?.telephone),
    );

    if (!address) {
      return NextResponse.json(
        { error: "식당 주소가 없습니다. Business Information에서 주소를 먼저 저장하세요." },
        { status: 400 },
      );
    }

    if (!phone) {
      return NextResponse.json(
        { error: "식당 전화번호가 없습니다. Business Information에서 전화번호를 먼저 저장하세요." },
        { status: 400 },
      );
    }

    const externalBusinessId = `ktown-biz-${businessId}`;
    const externalStoreId = `ktown-store-${businessId}`;

    await ensureBusiness({ externalBusinessId, name });
    const store = await ensureStore({
      externalBusinessId,
      externalStoreId,
      name,
      phone,
      address,
    });

    const status = firstText(store?.status, "active");
    const connectedAt = new Date().toISOString();

    const { data: saved, error: saveError } = await access.supabase
      .from("restaurant_order_private_settings")
      .upsert(
        {
          business_id: businessId,
          doordash_enabled: true,
          doordash_external_business_id: externalBusinessId,
          doordash_external_store_id: externalStoreId,
          doordash_status: status,
          doordash_connected_at: connectedAt,
          updated_at: connectedAt,
        },
        { onConflict: "business_id" },
      )
      .select(
        "business_id,doordash_enabled,doordash_external_business_id,doordash_external_store_id,doordash_status,doordash_connected_at",
      )
      .single();

    if (saveError) throw saveError;

    return NextResponse.json({
      ok: true,
      doorDashEnabled: saved?.doordash_enabled === true,
      doorDashConfigured: Boolean(
        saved?.doordash_external_business_id && saved?.doordash_external_store_id,
      ),
      externalBusinessId: String(saved?.doordash_external_business_id || ""),
      externalStoreId: String(saved?.doordash_external_store_id || ""),
      status: String(saved?.doordash_status || ""),
      connectedAt: saved?.doordash_connected_at || null,
      isTest: store?.is_test === true,
    });
  } catch (error) {
    return jsonError(error, "DoorDash 연결에 실패했습니다.");
  }
}
