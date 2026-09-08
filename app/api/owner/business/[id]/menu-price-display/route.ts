import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type PriceSource = "menu" | "pickup" | "delivery";

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

function normalizeSource(
  value: unknown,
  fallback: PriceSource,
): PriceSource {
  return value === "menu" ||
    value === "pickup" ||
    value === "delivery"
    ? value
    : fallback;
}

function validBusinessId(id: string) {
  const businessId = Number(id);
  return Number.isInteger(businessId) && businessId > 0
    ? businessId
    : null;
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
      .from("business_menu_price_display")
      .select(
        "menu_item_id,menu_source,pickup_source,delivery_source",
      )
      .eq("business_id", businessId);

    if (error) throw error;

    return NextResponse.json(
      {
        items: (data || []).map((row) => ({
          menuItemId: Number(row.menu_item_id),
          menuSource: normalizeSource(row.menu_source, "menu"),
          pickupSource: normalizeSource(row.pickup_source, "pickup"),
          deliverySource: normalizeSource(
            row.delivery_source,
            "delivery",
          ),
        })),
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("[owner menu-price-display GET]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "가격 표시 설정을 불러오지 못했습니다.",
      },
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
    const menuItemId = Number(body?.menuItemId);

    if (!Number.isInteger(menuItemId) || menuItemId <= 0) {
      return NextResponse.json(
        { error: "잘못된 메뉴 ID입니다." },
        { status: 400 },
      );
    }

    // Prevent saving a mapping for another business's menu item.
    const { data: menuItem, error: menuItemError } =
      await access.supabase
        .from("business_menu_items")
        .select("id")
        .eq("id", menuItemId)
        .eq("business_id", businessId)
        .maybeSingle();

    if (menuItemError) throw menuItemError;

    if (!menuItem) {
      return NextResponse.json(
        { error: "메뉴를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const menuSource = normalizeSource(body?.menuSource, "menu");
    const pickupSource = normalizeSource(
      body?.pickupSource,
      "pickup",
    );
    const deliverySource = normalizeSource(
      body?.deliverySource,
      "delivery",
    );

    const { error } = await access.supabase
      .from("business_menu_price_display")
      .upsert(
        {
          business_id: businessId,
          menu_item_id: menuItemId,
          menu_source: menuSource,
          pickup_source: pickupSource,
          delivery_source: deliverySource,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "business_id,menu_item_id",
        },
      );

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      menuItemId,
      menuSource,
      pickupSource,
      deliverySource,
    });
  } catch (error) {
    console.error("[owner menu-price-display PUT]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "가격 표시 설정 저장에 실패했습니다.",
      },
      { status: 500 },
    );
  }
}
