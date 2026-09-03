import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getSupabaseAdmin() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase server environment variables are missing.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function requireBusinessAccess(
  request: Request,
  businessId: number,
) {
  const authorization =
    request.headers.get("authorization") || "";

  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!accessToken) {
    return {
      allowed: false,
      status: 401,
      error: "로그인이 필요합니다.",
    };
  }

  const supabase = getSupabaseAdmin();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(accessToken);

  if (authError || !user) {
    return {
      allowed: false,
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

  if (profile?.role === "admin") {
    return {
      allowed: true,
      status: 200,
      error: "",
    };
  }

  const { data: owner, error: ownerError } =
    await supabase
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

  return {
    allowed: true,
    status: 200,
    error: "",
  };
}

async function readProviders(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  businessId: number,
) {
  const { data, error } = await supabase
    .from("business_delivery_providers")
    .select(
      "id,business_id,provider_key,name,url,is_enabled,display_order,is_custom",
    )
    .eq("business_id", businessId)
    .order("display_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;

  return data || [];
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

    const access = await requireBusinessAccess(
      request,
      businessId,
    );

    if (!access.allowed) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const supabase = getSupabaseAdmin();
    const providers = await readProviders(
      supabase,
      businessId,
    );

    return NextResponse.json(
      { providers },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error(
      "DELIVERY PROVIDERS GET ERROR:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "배달 업체를 불러오지 못했습니다.",
      },
      { status: 500 },
    );
  }
}

async function saveProviders(
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

    const access = await requireBusinessAccess(
      request,
      businessId,
    );

    if (!access.allowed) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const body = await request.json();

    const rawProviders = Array.isArray(body?.providers)
      ? body.providers
      : [];

    const providers = rawProviders.map(
      (provider: any, index: number) => {
        const providerKey = String(
          provider?.provider_key || "",
        ).trim();

        const name = String(
          provider?.name || "",
        ).trim();

        const url = String(
          provider?.url || "",
        ).trim();

        if (!providerKey) {
          throw new Error(
            `배달 업체 ${index + 1}의 provider_key가 없습니다.`,
          );
        }

        if (!name) {
          throw new Error(
            `배달 업체 ${index + 1}의 이름을 입력하세요.`,
          );
        }

        // 체크 상태는 URL 없이도 저장할 수 있습니다.
        // Public API에서 URL이 있는 업체만 고객에게 노출합니다.

        return {
          business_id: businessId,
          provider_key: providerKey,
          name,
          url,
          is_enabled:
            provider?.is_enabled === true,
          display_order: index,
          is_custom:
            provider?.is_custom === true ||
            providerKey.startsWith("custom-"),
        };
      },
    );

    const supabase = getSupabaseAdmin();

    // 저장할 때 해당 비즈니스의 설정을 통째로 교체합니다.
    // business_id + provider_key UNIQUE 제약이 없어도 동작하도록 upsert를 사용하지 않습니다.
    const { error: deleteError } = await supabase
      .from("business_delivery_providers")
      .delete()
      .eq("business_id", businessId);

    if (deleteError) throw deleteError;

    if (providers.length > 0) {
      const { error: insertError } = await supabase
        .from("business_delivery_providers")
        .insert(providers);

      if (insertError) throw insertError;
    }

    const savedProviders =
      await readProviders(
        supabase,
        businessId,
      );

    return NextResponse.json(
      {
        success: true,
        providers: savedProviders,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error(
      "DELIVERY PROVIDERS SAVE ERROR:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "배달 업체를 저장하지 못했습니다.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return saveProviders(request, context);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return saveProviders(request, context);
}
