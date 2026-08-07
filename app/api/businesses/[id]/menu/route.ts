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

function parseOptionalPrice(
  value: unknown,
  label: string,
) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const numberValue = Number(value);

  if (
    !Number.isFinite(numberValue) ||
    numberValue < 0
  ) {
    throw new Error(
      `${label}은 0 이상의 숫자여야 합니다.`,
    );
  }

  return Number(numberValue.toFixed(2));
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

    if (!Number.isInteger(businessId) || businessId <= 0) {
      return NextResponse.json(
        { error: "Invalid business id" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();

    const [
      { data: categories, error: categoryError },
      { data: items, error: itemError },
      { data: optionGroups, error: optionGroupError },
      { data: optionItems, error: optionItemError },
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
          "id,category_id,name,description,price,pickup_price,delivery_price,thumbnail_path,image_path,display_order,source_platform",
        )
        .eq("business_id", businessId)
        .eq("is_available", true)
        .order("display_order", { ascending: true })
        .order("id", { ascending: true }),

      supabase
        .from("business_menu_option_groups")
        .select(
          "id,menu_item_id,name,is_required,min_select,max_select,display_order",
        )
        .eq("business_id", businessId)
        .order("display_order", { ascending: true })
        .order("id", { ascending: true }),

      supabase
        .from("business_menu_option_items")
        .select(
          "id,option_group_id,name,price_delta,is_available,display_order",
        )
        .eq("business_id", businessId)
        .order("display_order", { ascending: true })
        .order("id", { ascending: true }),
    ]);

    if (categoryError) throw categoryError;
    if (itemError) throw itemError;
    if (optionGroupError) throw optionGroupError;
    if (optionItemError) throw optionItemError;

    const optionItemsByGroup = new Map<number, any[]>();

    for (const option of optionItems || []) {
      const groupId = Number(option.option_group_id);
      const list = optionItemsByGroup.get(groupId) || [];

      list.push({
        id: option.id,
        name: option.name,
        priceDelta: Number(option.price_delta ?? 0),
        price_delta: Number(option.price_delta ?? 0),
        soldOut: option.is_available === false,
        sold_out: option.is_available === false,
        is_available: option.is_available !== false,
        displayOrder: Number(option.display_order ?? 0),
        display_order: Number(option.display_order ?? 0),
      });

      optionItemsByGroup.set(groupId, list);
    }

    const optionGroupsByMenu = new Map<number, any[]>();

    for (const group of optionGroups || []) {
      const menuItemId = Number(group.menu_item_id);
      const list = optionGroupsByMenu.get(menuItemId) || [];
      const minSelect = Math.max(
        0,
        Number(group.min_select ?? 0),
      );
      const rawMax = group.max_select;
      const maxSelect =
        rawMax === null || rawMax === undefined
          ? null
          : Math.max(0, Number(rawMax));

      list.push({
        id: group.id,
        name: group.name,
        required: group.is_required === true,
        is_required: group.is_required === true,
        minSelect,
        min_select: minSelect,
        maxSelect,
        max_select: maxSelect,
        displayOrder: Number(group.display_order ?? 0),
        display_order: Number(group.display_order ?? 0),
        options:
          optionItemsByGroup.get(Number(group.id)) || [],
      });

      optionGroupsByMenu.set(menuItemId, list);
    }

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

      const groups =
        optionGroupsByMenu.get(Number(item.id)) || [];

      const basePrice =
        item.price === null ||
        item.price === undefined
          ? null
          : Number(item.price);

      const pickupPrice =
        item.pickup_price === null ||
        item.pickup_price === undefined
          ? basePrice
          : Number(item.pickup_price);

      const deliveryPrice =
        item.delivery_price === null ||
        item.delivery_price === undefined
          ? pickupPrice
          : Number(item.delivery_price);

      return {
        id: item.id,
        category_id: item.category_id,
        name: item.name,
        description: item.description,

        // 기본 메뉴 단가
        price: basePrice,

        // 픽업/배달 단가
        pickup_price: pickupPrice,
        delivery_price: deliveryPrice,

        // camelCase도 같이 제공해서 프론트 호환
        pickupPrice,
        deliveryPrice,

        display_order: item.display_order,
        thumbnail_url: thumbnailUrl,
        image_url: imageUrl,
        source_platform: item.source_platform || null,

        // 프론트 호환을 위해 camelCase와 snake_case를 둘 다 제공합니다.
        option_groups: groups,
        optionGroups: groups,
        menu_option_groups: groups,
      };
    });

    return NextResponse.json(
      {
        categories: categories || [],
        items: withUrls,
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

    if (!Number.isInteger(businessId) || businessId <= 0) {
      return NextResponse.json(
        { error: "Invalid business id" },
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
        pickup_price?: unknown;
        pickupPrice?: unknown;
        delivery_price?: unknown;
        deliveryPrice?: unknown;
      }) => {
        const itemId = Number(item.id);

        if (!Number.isInteger(itemId) || itemId <= 0) {
          throw new Error(
            "잘못된 메뉴 ID입니다.",
          );
        }

        const price = parseOptionalPrice(
          item.price,
          "메뉴 가격",
        );

        const pickupPrice = parseOptionalPrice(
          item.pickup_price ?? item.pickupPrice,
          "픽업 가격",
        );

        const deliveryPrice = parseOptionalPrice(
          item.delivery_price ?? item.deliveryPrice,
          "배달 가격",
        );

        return {
          id: itemId,
          price,
          pickup_price: pickupPrice,
          delivery_price: deliveryPrice,
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
          pickup_price: item.pickup_price,
          delivery_price: item.delivery_price,
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
            : "Menu price update failed",
      },
      { status: 500 },
    );
  }
}