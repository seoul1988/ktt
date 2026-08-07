import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are missing.");
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
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { allowed: false, status: 401, error: "로그인 세션이 올바르지 않습니다." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "admin") {
    return { allowed: true, status: 200, error: "" };
  }

  const { data: owner } = await supabase
    .from("business_owners")
    .select("business_id")
    .eq("business_id", businessId)
    .eq("user_id", user.id)
    .eq("status", "approved")
    .maybeSingle();

  if (!owner) {
    return { allowed: false, status: 403, error: "이 비즈니스를 관리할 권한이 없습니다." };
  }

  return { allowed: true, status: 200, error: "" };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);

    const access = await requireBusinessAccess(request, businessId);
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("business_delivery_providers")
      .select("id,business_id,provider_key,name,url,is_enabled,display_order,is_custom")
      .eq("business_id", businessId)
      .order("display_order", { ascending: true })
      .order("id", { ascending: true });

    if (error) throw error;

    return NextResponse.json(
      { providers: data || [] },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "배달 업체를 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);

    const access = await requireBusinessAccess(request, businessId);
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = await request.json();
    const providers = Array.isArray(body?.providers) ? body.providers : [];

    const normalized = providers.map((provider: any, index: number) => {
      const providerKey = String(provider?.provider_key || "").trim();
      const name = String(provider?.name || "").trim();
      const url = String(provider?.url || "").trim();

      if (!providerKey || !name) {
        throw new Error("배달 업체 이름 또는 키가 올바르지 않습니다.");
      }

      if (provider?.is_enabled === true && !url) {
        throw new Error(`${name}의 주문 링크를 입력하세요.`);
      }

      return {
        business_id: businessId,
        provider_key: providerKey,
        name,
        url,
        is_enabled: provider?.is_enabled === true,
        display_order: index,
        is_custom:
          provider?.is_custom === true ||
          providerKey.startsWith("custom-"),
        updated_at: new Date().toISOString(),
      };
    });

    const supabase = getSupabaseAdmin();

    const { error: deleteError } = await supabase
      .from("business_delivery_providers")
      .delete()
      .eq("business_id", businessId);

    if (deleteError) throw deleteError;

    if (normalized.length) {
      const { error: insertError } = await supabase
        .from("business_delivery_providers")
        .insert(normalized);

      if (insertError) throw insertError;
    }

    const { data, error } = await supabase
      .from("business_delivery_providers")
      .select("id,business_id,provider_key,name,url,is_enabled,display_order,is_custom")
      .eq("business_id", businessId)
      .order("display_order", { ascending: true })
      .order("id", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, providers: data || [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "배달 업체를 저장하지 못했습니다." },
      { status: 500 },
    );
  }
}