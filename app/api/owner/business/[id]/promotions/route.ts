import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function adminClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase server environment variables are missing.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function requireAccess(request: Request, businessId: number) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

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

function validBusinessId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function safePromotions(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function safeAssignments(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const businessId = validBusinessId(id);

    if (!businessId) {
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

    const { data, error } = await access.supabase
      .from("restaurant_promotion_state")
      .select("promotions,assignments,updated_at")
      .eq("business_id", businessId)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json(
      {
        initialized: Boolean(data),
        promotions: safePromotions(data?.promotions),
        assignments: safeAssignments(data?.assignments),
        updatedAt: data?.updated_at || null,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("[owner promotions GET]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "딜 설정을 불러오지 못했습니다.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const businessId = validBusinessId(id);

    if (!businessId) {
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

    const body = await request.json();
    const hasPromotions = Object.prototype.hasOwnProperty.call(
      body || {},
      "promotions",
    );
    const hasAssignments = Object.prototype.hasOwnProperty.call(
      body || {},
      "assignments",
    );

    if (!hasPromotions && !hasAssignments) {
      return NextResponse.json(
        { error: "저장할 딜 데이터가 없습니다." },
        { status: 400 },
      );
    }

    const { data: current, error: currentError } = await access.supabase
      .from("restaurant_promotion_state")
      .select("promotions,assignments")
      .eq("business_id", businessId)
      .maybeSingle();

    if (currentError) throw currentError;

    const promotions = hasPromotions
      ? safePromotions(body?.promotions)
      : safePromotions(current?.promotions);

    const assignments = hasAssignments
      ? safeAssignments(body?.assignments)
      : safeAssignments(current?.assignments);

    const { data: saved, error: saveError } = await access.supabase
      .from("restaurant_promotion_state")
      .upsert(
        {
          business_id: businessId,
          promotions,
          assignments,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id" },
      )
      .select("promotions,assignments,updated_at")
      .single();

    if (saveError) throw saveError;

    return NextResponse.json(
      {
        success: true,
        initialized: true,
        promotions: safePromotions(saved?.promotions),
        assignments: safeAssignments(saved?.assignments),
        updatedAt: saved?.updated_at || null,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("[owner promotions PATCH]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "딜 설정 저장에 실패했습니다.",
      },
      { status: 500 },
    );
  }
}
