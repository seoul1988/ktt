import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AccessResult = {
  allowed: boolean;
  status: number;
  error: string;
};

function getSupabaseAdmin() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getBearerToken(request: Request) {
  const authorization =
    request.headers.get("authorization") || "";

  if (!authorization.startsWith("Bearer ")) {
    return "";
  }

  return authorization.slice(7).trim();
}

async function requireBusinessManagementAccess(
  request: Request,
  businessId: number,
): Promise<AccessResult> {
  const token = getBearerToken(request);

  if (!token) {
    return {
      allowed: false,
      status: 401,
      error: "로그인이 필요합니다.",
    };
  }

  const supabase = getSupabaseAdmin();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return {
      allowed: false,
      status: 401,
      error: "로그인 정보를 확인할 수 없습니다.",
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

  const [
    { data: owner, error: ownerError },
    { data: business, error: businessError },
  ] = await Promise.all([
    supabase
      .from("business_owners")
      .select("business_id")
      .eq("business_id", businessId)
      .eq("user_id", user.id)
      .eq("status", "approved")
      .maybeSingle(),

    supabase
      .from("businesses")
      .select("website_enabled")
      .eq("id", businessId)
      .maybeSingle(),
  ]);

  if (ownerError) throw ownerError;
  if (businessError) throw businessError;

  if (!owner) {
    return {
      allowed: false,
      status: 403,
      error: "이 비즈니스를 관리할 권한이 없습니다.",
    };
  }

  if (business?.website_enabled !== true) {
    return {
      allowed: false,
      status: 403,
      error: "사이트 관리가 활성화되지 않았습니다.",
    };
  }

  return {
    allowed: true,
    status: 200,
    error: "",
  };
}

function storagePublicUrl(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  path: string | null,
) {
  if (!path) return null;

  if (
    path.startsWith("http://") ||
    path.startsWith("https://")
  ) {
    return path;
  }

  return supabase.storage
    .from("menu-images")
    .getPublicUrl(path).data.publicUrl;
}

export async function GET(
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
        { error: "잘못된 비즈니스 ID입니다." },
        { status: 400 },
      );
    }

    const access =
      await requireBusinessManagementAccess(
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

    const [
      { data: business, error: businessError },
      { data: categories, error: categoryError },
      { data: items, error: itemError },
    ] = await Promise.all([
      supabase
        .from("businesses")
        .select("id,name")
        .eq("id", businessId)
        .maybeSingle(),

      supabase
        .from("business_menu_categories")
        .select(
          "id,name,display_order,is_active",
        )
        .eq("business_id", businessId)
        .order("display_order", {
          ascending: true,
          nullsFirst: false,
        })
        .order("id", { ascending: true }),

      supabase
        .from("business_menu_items")
        .select(
          "id,category_id,name,description,price,thumbnail_path,image_path,display_order,is_available",
        )
        .eq("business_id", businessId)
        .order("display_order", {
          ascending: true,
          nullsFirst: false,
        })
        .order("id", { ascending: true }),
    ]);

    if (businessError) throw businessError;
    if (categoryError) throw categoryError;
    if (itemError) throw itemError;

    const itemsWithUrls = (items || []).map(
      (item) => ({
        ...item,
        thumbnail_url: storagePublicUrl(
          supabase,
          item.thumbnail_path,
        ),
        image_url: storagePublicUrl(
          supabase,
          item.image_path,
        ),
      }),
    );

    return NextResponse.json(
      {
        business,
        categories: categories || [],
        items: itemsWithUrls,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, max-age=0",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "메뉴를 불러오지 못했습니다.",
      },
      { status: 500 },
    );
  }
}

export async function POST(
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
        { error: "잘못된 비즈니스 ID입니다." },
        { status: 400 },
      );
    }

    const access =
      await requireBusinessManagementAccess(
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

    if (body?.action !== "add-category") {
      return NextResponse.json(
        { error: "지원하지 않는 작업입니다." },
        { status: 400 },
      );
    }

    const name = String(body?.name || "").trim();

    if (!name) {
      return NextResponse.json(
        { error: "카테고리 이름을 입력하세요." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: lastCategory } = await supabase
      .from("business_menu_categories")
      .select("display_order")
      .eq("business_id", businessId)
      .order("display_order", {
        ascending: false,
        nullsFirst: false,
      })
      .limit(1)
      .maybeSingle();

    const nextOrder =
      Number(lastCategory?.display_order || 0) + 1;

    const { data: category, error } =
      await supabase
        .from("business_menu_categories")
        .insert({
          business_id: businessId,
          name,
          display_order: nextOrder,
          is_active: true,
        })
        .select(
          "id,name,display_order,is_active",
        )
        .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      category,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "카테고리를 추가하지 못했습니다.",
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
        { error: "잘못된 비즈니스 ID입니다." },
        { status: 400 },
      );
    }

    const access =
      await requireBusinessManagementAccess(
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

    const categories = Array.isArray(
      body?.categories,
    )
      ? body.categories
      : [];

    const items = Array.isArray(body?.items)
      ? body.items
      : [];

    const supabase = getSupabaseAdmin();

    let updatedCategories = 0;
    let updatedItems = 0;

    for (const rawCategory of categories) {
      const categoryId = Number(rawCategory?.id);
      const name = String(
        rawCategory?.name || "",
      ).trim();

      if (
        !Number.isInteger(categoryId) ||
        categoryId <= 0
      ) {
        throw new Error(
          "잘못된 카테고리 ID가 있습니다.",
        );
      }

      if (!name) {
        throw new Error(
          "카테고리 이름은 비워둘 수 없습니다.",
        );
      }

      const { data, error } = await supabase
        .from("business_menu_categories")
        .update({
          name,
          display_order: Number(
            rawCategory?.display_order ?? 999,
          ),
          is_active:
            rawCategory?.is_active !== false,
        })
        .eq("business_id", businessId)
        .eq("id", categoryId)
        .select("id")
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error(
          `카테고리 ID ${categoryId}를 찾지 못했습니다.`,
        );
      }

      updatedCategories += 1;
    }

    for (const rawItem of items) {
      const itemId = Number(rawItem?.id);
      const name = String(
        rawItem?.name || "",
      ).trim();

      if (
        !Number.isInteger(itemId) ||
        itemId <= 0
      ) {
        throw new Error(
          "잘못된 메뉴 ID가 있습니다.",
        );
      }

      if (!name) {
        throw new Error(
          "상품명은 비워둘 수 없습니다.",
        );
      }

      const categoryId =
        rawItem?.category_id === null ||
        rawItem?.category_id === undefined ||
        rawItem?.category_id === ""
          ? null
          : Number(rawItem.category_id);

      if (
        categoryId !== null &&
        (!Number.isInteger(categoryId) ||
          categoryId <= 0)
      ) {
        throw new Error(
          `${name}의 카테고리가 올바르지 않습니다.`,
        );
      }

      const price =
        rawItem?.price === null ||
        rawItem?.price === undefined ||
        rawItem?.price === ""
          ? null
          : Number(rawItem.price);

      if (
        price !== null &&
        (!Number.isFinite(price) || price < 0)
      ) {
        throw new Error(
          `${name}의 가격이 올바르지 않습니다.`,
        );
      }

      const { data, error } = await supabase
        .from("business_menu_items")
        .update({
          category_id: categoryId,
          name,
          description:
            String(
              rawItem?.description || "",
            ).trim() || null,
          price:
            price === null
              ? null
              : Number(price.toFixed(2)),
          display_order: Number(
            rawItem?.display_order ?? 999,
          ),
          is_available:
            rawItem?.is_available !== false,
        })
        .eq("business_id", businessId)
        .eq("id", itemId)
        .select("id")
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error(
          `메뉴 ID ${itemId}를 찾지 못했습니다.`,
        );
      }

      updatedItems += 1;
    }

    return NextResponse.json({
      success: true,
      updatedCategories,
      updatedItems,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "메뉴를 저장하지 못했습니다.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
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
        { error: "잘못된 비즈니스 ID입니다." },
        { status: 400 },
      );
    }

    const access =
      await requireBusinessManagementAccess(
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
    const categoryId = Number(
      body?.categoryId,
    );

    if (
      !Number.isInteger(categoryId) ||
      categoryId <= 0
    ) {
      return NextResponse.json(
        { error: "잘못된 카테고리 ID입니다." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();

    const { count, error: countError } =
      await supabase
        .from("business_menu_items")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("business_id", businessId)
        .eq("category_id", categoryId);

    if (countError) throw countError;

    if ((count || 0) > 0) {
      return NextResponse.json(
        {
          error:
            "이 카테고리에 메뉴가 있습니다. 먼저 메뉴를 다른 카테고리로 옮겨주세요.",
        },
        { status: 409 },
      );
    }

    const { data, error } = await supabase
      .from("business_menu_categories")
      .delete()
      .eq("business_id", businessId)
      .eq("id", categoryId)
      .select("id")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { error: "카테고리를 찾지 못했습니다." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "카테고리를 삭제하지 못했습니다.",
      },
      { status: 500 },
    );
  }
}
