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

async function requireBusinessAccess(request: Request, businessId: number) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!token) {
    return { allowed: false, status: 401, error: "로그인이 필요합니다." };
  }

  const supabase = getSupabaseAdmin();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return { allowed: false, status: 401, error: "로그인 세션이 올바르지 않습니다." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (profile?.role === "admin") {
    return { allowed: true, status: 200, error: "" };
  }

  const { data: owner, error: ownerError } = await supabase
    .from("business_owners")
    .select("business_id")
    .eq("business_id", businessId)
    .eq("user_id", user.id)
    .eq("status", "approved")
    .maybeSingle();

  if (ownerError) throw ownerError;
  if (!owner) {
    return {
      allowed: false,
      status: 403,
      error: "이 비즈니스를 관리할 권한이 없습니다.",
    };
  }

  return { allowed: true, status: 200, error: "" };
}

function normalizeTaxRate(value: unknown) {
  const rate = Number(value);
  if (!Number.isFinite(rate)) return null;
  if (rate < 0 || rate > 1) return null;
  return rate;
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

    const access = await requireBusinessAccess(request, businessId);
    if (!access.allowed) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const body = await request.json();
    const taxRate = normalizeTaxRate(body?.taxRate);

    if (taxRate == null) {
      return NextResponse.json(
        { error: "Tax rate는 0에서 1 사이 값이어야 합니다." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("restaurant_order_settings")
      .upsert(
        {
          business_id: businessId,
          tax_rate: taxRate,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id" },
      )
      .select("business_id,tax_rate")
      .single();

    if (error) throw error;

    return NextResponse.json(
      {
        success: true,
        businessId: data.business_id,
        taxRate: Number(data.tax_rate || 0),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("[owner order-tax PUT]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Tax 저장에 실패했습니다.",
      },
      { status: 500 },
    );
  }
}
