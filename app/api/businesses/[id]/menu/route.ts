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
      .select("user_id")
      .eq("business_id", businessId)
      .eq("user_id", user.id)
      .eq("status", "approved")
      .maybeSingle();

  if (ownerError) throw ownerError;

  if (owner) {
    return {
      allowed: true,
      status: 200,
      error: "",
    };
  }

  return {
    allowed: false,
    status: 403,
    error: "이 비즈니스의 메뉴를 수정할 권한이 없습니다.",
  };
}

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);

    if (
      !Number.isInteger(businessId) ||
      businessId <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid business id" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();

    const [
      { data: categories, error: categoryError },
      { data: items, error: itemError },
    ] = await Promise.all([
      supabase
        .from("business_menu_categories")
        .select("id,name,display_order")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("id", { ascending: true }),

      supabase
        .from("business_menu_items")
        .select(
          "id,category_id,name,description,price,thumbnail_path,image_path,display_order",
        )
        .eq("business_id", businessId)
        .eq("is_available", true)
        .order("display_order", { ascending: true })
        .order("id", { ascending: true }),
    ]);

    if (categoryError) throw categoryError;
    if (itemError) throw itemError;

    const withUrls = (items || []).map((item) => {
      const thumbnailUrl = item.thumbnail_path
        ? supabase.storage
            .from("menu-images")
            .getPublicUrl(item.thumbnail_path).data.publicUrl
        : null;

      const imageUrl = item.image_path
        ? supabase.storage
            .from("menu-images")
            .getPublicUrl(item.image_path).data.publicUrl
        : null;

      return {
        id: item.id,
        category_id: item.category_id,
        name: item.name,
        description: item.description,
        price: item.price,
        display_order: item.display_order,
        thumbnail_url: thumbnailUrl,
        image_url: imageUrl,
      };
    });

    return NextResponse.json(
      {
        categories: categories || [],
        items: withUrls,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Menu load failed",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);

    if (
      !Number.isInteger(businessId) ||
      businessId <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid business id" },
        { status: 400 },
      );
    }

    const access =
      await requireBusinessAccess(request, businessId);

    if (!access.allowed) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const body = await request.json();

    const items = Array.isArray(body?.items)
      ? body.items
      : [];

    if (items.length === 0) {
      return NextResponse.json(
        { error: "저장할 메뉴 가격이 없습니다." },
        { status: 400 },
      );
    }

    const normalizedItems = items.map(
      (item: {
        id?: unknown;
        price?: unknown;
      }) => {
        const itemId = Number(item.id);

        if (
          !Number.isInteger(itemId) ||
          itemId <= 0
        ) {
          throw new Error("잘못된 메뉴 ID입니다.");
        }

        const price =
          item.price === null ||
          item.price === undefined ||
          String(item.price).trim() === ""
            ? null
            : Number(item.price);

        if (
          price !== null &&
          (!Number.isFinite(price) || price < 0)
        ) {
          throw new Error(
            "메뉴 가격은 0 이상의 숫자여야 합니다.",
          );
        }

        return {
          id: itemId,
          price:
            price === null
              ? null
              : Number(price.toFixed(2)),
        };
      },
    );

    const supabase = getSupabaseAdmin();

    let updatedCount = 0;

    for (const item of normalizedItems) {
      const { data, error } = await supabase
        .from("business_menu_items")
        .update({
          price: item.price,
        })
        .eq("id", item.id)
        .eq("business_id", businessId)
        .select("id")
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error(
          `메뉴 ID ${item.id}를 찾지 못했습니다.`,
        );
      }

      updatedCount += 1;
    }

    return NextResponse.json(
      {
        success: true,
        updatedCount,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Menu price update failed",
      },
      { status: 500 },
    );
  }
}

