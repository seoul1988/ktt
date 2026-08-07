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


function parseImportedOptionRules(
  nameValue: unknown,
  isRequiredValue: unknown,
  minSelectValue: unknown,
  maxSelectValue: unknown,
) {
  const name = String(nameValue || "");
  const requiredMatch = name.match(/(\d+)\s*required/i);
  const maximumMatch = name.match(/(\d+)\s*maximum/i);

  const rawMin = Math.max(
    0,
    Math.floor(Number(minSelectValue) || 0),
  );

  const parsedRequired = requiredMatch
    ? Math.max(0, Math.floor(Number(requiredMatch[1]) || 0))
    : 0;

  const required =
    isRequiredValue === true ||
    rawMin > 0 ||
    parsedRequired > 0;

  const minSelect =
    rawMin > 0
      ? rawMin
      : parsedRequired > 0
        ? parsedRequired
        : required
          ? 1
          : 0;

  const explicitMax =
    maxSelectValue === null ||
    maxSelectValue === undefined ||
    String(maxSelectValue).trim() === ""
      ? null
      : Math.max(
          0,
          Math.floor(Number(maxSelectValue) || 0),
        );

  const parsedMax = maximumMatch
    ? Math.max(0, Math.floor(Number(maximumMatch[1]) || 0))
    : null;

  let maxSelect =
    explicitMax != null && explicitMax > 0
      ? explicitMax
      : parsedMax != null && parsedMax > 0
        ? parsedMax
        : null;

  if (
    maxSelect == null &&
    minSelect === 1 &&
    /\b1\s*required\b/i.test(name)
  ) {
    maxSelect = 1;
  }

  return {
    required,
    minSelect,
    maxSelect,
  };
}

function hasOptionPayload(rawItem: any) {
  return (
    Object.prototype.hasOwnProperty.call(rawItem || {}, "option_groups") ||
    Object.prototype.hasOwnProperty.call(rawItem || {}, "optionGroups") ||
    Object.prototype.hasOwnProperty.call(rawItem || {}, "menu_option_groups")
  );
}

function readOptionPayload(rawItem: any) {
  const raw =
    rawItem?.option_groups ??
    rawItem?.optionGroups ??
    rawItem?.menu_option_groups ??
    [];

  return Array.isArray(raw) ? raw : [];
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
      { data: optionGroups, error: optionGroupError },
      { data: optionItems, error: optionItemError },
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
          "id,category_id,name,description,price,pickup_price,delivery_price,thumbnail_path,image_path,display_order,is_available",
        )
        .eq("business_id", businessId)
        .order("display_order", {
          ascending: true,
          nullsFirst: false,
        })
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

    if (businessError) throw businessError;
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

      const rules = parseImportedOptionRules(
        group.name,
        group.is_required,
        group.min_select,
        group.max_select,
      );

      list.push({
        id: group.id,
        name: group.name,
        required: rules.required,
        is_required: rules.required,
        minSelect: rules.minSelect,
        min_select: rules.minSelect,
        maxSelect: rules.maxSelect,
        max_select: rules.maxSelect,
        displayOrder: Number(group.display_order ?? 0),
        display_order: Number(group.display_order ?? 0),
        options:
          optionItemsByGroup.get(Number(group.id)) || [],
      });

      optionGroupsByMenu.set(menuItemId, list);
    }

    const itemsWithUrls = (items || []).map(
      (item) => {
        const groups =
          optionGroupsByMenu.get(Number(item.id)) || [];

        return {
          ...item,
          thumbnail_url: storagePublicUrl(
            supabase,
            item.thumbnail_path,
          ),
          image_url: storagePublicUrl(
            supabase,
            item.image_path,
          ),
          option_groups: groups,
          optionGroups: groups,
          menu_option_groups: groups,
        };
      },
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
    const action = String(body?.action || "");
    const supabase = getSupabaseAdmin();

    if (action === "add-category") {
      const name = String(body?.name || "").trim();

      if (!name) {
        return NextResponse.json(
          { error: "카테고리 이름을 입력하세요." },
          { status: 400 },
        );
      }

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
    }

    if (action === "add-menu-item") {
      const categoryId = Number(body?.categoryId);

      if (
        !Number.isInteger(categoryId) ||
        categoryId <= 0
      ) {
        return NextResponse.json(
          { error: "메뉴를 추가할 카테고리를 선택하세요." },
          { status: 400 },
        );
      }

      const { data: category, error: categoryError } =
        await supabase
          .from("business_menu_categories")
          .select("id")
          .eq("business_id", businessId)
          .eq("id", categoryId)
          .maybeSingle();

      if (categoryError) throw categoryError;

      if (!category) {
        return NextResponse.json(
          { error: "카테고리를 찾지 못했습니다." },
          { status: 404 },
        );
      }

      const { data: lastItem, error: lastItemError } =
        await supabase
          .from("business_menu_items")
          .select("display_order")
          .eq("business_id", businessId)
          .eq("category_id", categoryId)
          .order("display_order", {
            ascending: false,
            nullsFirst: false,
          })
          .limit(1)
          .maybeSingle();

      if (lastItemError) throw lastItemError;

      const nextOrder =
        Number(lastItem?.display_order || 0) + 1;

      const { data: item, error: itemError } =
        await supabase
          .from("business_menu_items")
          .insert({
            business_id: businessId,
            category_id: categoryId,
            name: "NEW MENU ITEM",
            description: "",
            price: null,
            pickup_price: null,
            delivery_price: null,
            thumbnail_path: null,
            image_path: null,
            display_order: nextOrder,
            is_available: true,
            source_platform: "manual",
          })
          .select(
            "id,category_id,name,description,price,pickup_price,delivery_price,thumbnail_path,image_path,display_order,is_available",
          )
          .single();

      if (itemError) throw itemError;

      return NextResponse.json({
        success: true,
        item: {
          ...item,
          thumbnail_url: null,
          image_url: null,
          option_groups: [],
          optionGroups: [],
          menu_option_groups: [],
        },
      });
    }

    if (action === "duplicate-menu-item") {
      const itemId = Number(body?.itemId);

      if (
        !Number.isInteger(itemId) ||
        itemId <= 0
      ) {
        return NextResponse.json(
          { error: "복제할 메뉴 ID가 올바르지 않습니다." },
          { status: 400 },
        );
      }

      const { data: sourceItem, error: sourceError } =
        await supabase
          .from("business_menu_items")
          .select(
            "id,category_id,name,description,price,pickup_price,delivery_price,display_order,is_available",
          )
          .eq("business_id", businessId)
          .eq("id", itemId)
          .maybeSingle();

      if (sourceError) throw sourceError;

      if (!sourceItem) {
        return NextResponse.json(
          { error: "복제할 메뉴를 찾지 못했습니다." },
          { status: 404 },
        );
      }

      const { data: lastItem, error: lastItemError } =
        await supabase
          .from("business_menu_items")
          .select("display_order")
          .eq("business_id", businessId)
          .eq("category_id", sourceItem.category_id)
          .order("display_order", {
            ascending: false,
            nullsFirst: false,
          })
          .limit(1)
          .maybeSingle();

      if (lastItemError) throw lastItemError;

      const nextOrder =
        Number(lastItem?.display_order || 0) + 1;

      const { data: duplicatedItem, error: duplicateError } =
        await supabase
          .from("business_menu_items")
          .insert({
            business_id: businessId,
            category_id: sourceItem.category_id,
            name: `${sourceItem.name} (Copy)`,
            description: String(sourceItem.description ?? ""),
            price: sourceItem.price,
            pickup_price: sourceItem.pickup_price ?? sourceItem.price,
            delivery_price:
              sourceItem.delivery_price ??
              sourceItem.pickup_price ??
              sourceItem.price,
            thumbnail_path: null,
            image_path: null,
            display_order: nextOrder,
            is_available: sourceItem.is_available !== false,
            source_platform: "manual",
          })
          .select(
            "id,category_id,name,description,price,pickup_price,delivery_price,thumbnail_path,image_path,display_order,is_available",
          )
          .single();

      if (duplicateError) throw duplicateError;

      const { data: sourceGroups, error: groupsError } =
        await supabase
          .from("business_menu_option_groups")
          .select(
            "id,name,is_required,min_select,max_select,display_order",
          )
          .eq("business_id", businessId)
          .eq("menu_item_id", itemId)
          .order("display_order", { ascending: true })
          .order("id", { ascending: true });

      if (groupsError) throw groupsError;

      const sourceGroupIds = (sourceGroups || []).map(
        (group) => Number(group.id),
      );

      const sourceOptionsByGroup = new Map<number, any[]>();

      if (sourceGroupIds.length > 0) {
        const { data: sourceOptions, error: optionsError } =
          await supabase
            .from("business_menu_option_items")
            .select(
              "option_group_id,name,price_delta,is_available,display_order",
            )
            .eq("business_id", businessId)
            .in("option_group_id", sourceGroupIds)
            .order("display_order", { ascending: true });

        if (optionsError) throw optionsError;

        for (const option of sourceOptions || []) {
          const groupId = Number(option.option_group_id);
          const list =
            sourceOptionsByGroup.get(groupId) || [];
          list.push(option);
          sourceOptionsByGroup.set(groupId, list);
        }
      }

      const duplicatedGroups: any[] = [];

      for (const sourceGroup of sourceGroups || []) {
        const {
          data: newGroup,
          error: newGroupError,
        } = await supabase
          .from("business_menu_option_groups")
          .insert({
            business_id: businessId,
            menu_item_id: duplicatedItem.id,
            name: sourceGroup.name,
            is_required: sourceGroup.is_required === true,
            min_select: Number(sourceGroup.min_select ?? 0),
            max_select:
              sourceGroup.max_select == null
                ? null
                : Number(sourceGroup.max_select),
            display_order: Number(
              sourceGroup.display_order ?? 0,
            ),
          })
          .select("id")
          .single();

        if (newGroupError) throw newGroupError;

        const sourceOptions =
          sourceOptionsByGroup.get(
            Number(sourceGroup.id),
          ) || [];

        if (sourceOptions.length > 0) {
          const { error: insertOptionsError } =
            await supabase
              .from("business_menu_option_items")
              .insert(
                sourceOptions.map((option) => ({
                  business_id: businessId,
                  option_group_id: newGroup.id,
                  name: option.name,
                  price_delta: Number(
                    option.price_delta ?? 0,
                  ),
                  is_available:
                    option.is_available !== false,
                  display_order: Number(
                    option.display_order ?? 0,
                  ),
                })),
              );

          if (insertOptionsError) {
            throw insertOptionsError;
          }
        }

        const rules = parseImportedOptionRules(
          sourceGroup.name,
          sourceGroup.is_required,
          sourceGroup.min_select,
          sourceGroup.max_select,
        );

        duplicatedGroups.push({
          name: sourceGroup.name,
          required: rules.required,
          minSelect: rules.minSelect,
          maxSelect: rules.maxSelect,
          displayOrder: Number(
            sourceGroup.display_order ?? 0,
          ),
          options: sourceOptions.map((option) => ({
            name: option.name,
            priceDelta: Number(
              option.price_delta ?? 0,
            ),
            soldOut:
              option.is_available === false,
            displayOrder: Number(
              option.display_order ?? 0,
            ),
          })),
        });
      }

      return NextResponse.json({
        success: true,
        item: {
          ...duplicatedItem,
          thumbnail_url: null,
          image_url: null,
          option_groups: duplicatedGroups,
          optionGroups: duplicatedGroups,
          menu_option_groups: duplicatedGroups,
        },
      });
    }

    return NextResponse.json(
      { error: "지원하지 않는 작업입니다." },
      { status: 400 },
    );
  } catch (error) {
    console.error("OWNER MENU POST ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "메뉴 작업을 처리하지 못했습니다.",
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
    let updatedOptionGroups = 0;
    let updatedOptionItems = 0;

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

      const rawPickupPrice =
        rawItem?.pickup_price ?? rawItem?.pickupPrice ?? null;
      const pickupPrice =
        rawPickupPrice == null || rawPickupPrice === ""
          ? null
          : Number(rawPickupPrice);

      if (
        pickupPrice !== null &&
        (!Number.isFinite(pickupPrice) || pickupPrice < 0)
      ) {
        throw new Error(`${name}의 픽업 단가가 올바르지 않습니다.`);
      }

      const rawDeliveryPrice =
        rawItem?.delivery_price ?? rawItem?.deliveryPrice ?? null;
      const deliveryPrice =
        rawDeliveryPrice == null || rawDeliveryPrice === ""
          ? null
          : Number(rawDeliveryPrice);

      if (
        deliveryPrice !== null &&
        (!Number.isFinite(deliveryPrice) || deliveryPrice < 0)
      ) {
        throw new Error(`${name}의 배달 단가가 올바르지 않습니다.`);
      }

      const { data, error } = await supabase
        .from("business_menu_items")
        .update({
          category_id: categoryId,
          name,
          // business_menu_items.description is NOT NULL.
          // 빈 설명은 null이 아니라 빈 문자열로 저장합니다.
          description: String(
            rawItem?.description ?? "",
          ).trim(),
          price:
            price === null
              ? null
              : Number(price.toFixed(2)),
          pickup_price:
            pickupPrice === null
              ? null
              : Number(pickupPrice.toFixed(2)),
          delivery_price:
            deliveryPrice === null
              ? null
              : Number(deliveryPrice.toFixed(2)),
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

      /*
       * 옵션 데이터가 요청에 포함된 메뉴만 동기화합니다.
       * 예전 클라이언트가 option_groups를 보내지 않는 경우
       * 기존 옵션을 실수로 지우지 않습니다.
       */
      if (!hasOptionPayload(rawItem)) {
        continue;
      }

      const rawGroups = readOptionPayload(rawItem);

      const normalizedGroups = rawGroups.map(
        (rawGroup: any, groupIndex: number) => {
          const groupName = String(
            rawGroup?.name || "",
          ).trim();

          if (!groupName) {
            throw new Error(
              `${name}: 옵션 그룹 이름은 비워둘 수 없습니다.`,
            );
          }

          const required =
            rawGroup?.required === true ||
            rawGroup?.is_required === true;

          const minSelect = Math.max(
            0,
            Math.floor(
              Number(
                rawGroup?.minSelect ??
                  rawGroup?.min_select ??
                  (required ? 1 : 0),
              ) || 0,
            ),
          );

          const rawMax =
            rawGroup?.maxSelect ??
            rawGroup?.max_select;

          const maxSelect =
            rawMax === null ||
            rawMax === undefined ||
            String(rawMax).trim() === ""
              ? null
              : Math.max(
                  0,
                  Math.floor(Number(rawMax) || 0),
                );

          if (
            maxSelect !== null &&
            maxSelect < minSelect
          ) {
            throw new Error(
              `${name} / ${groupName}: 최대 선택 수는 최소 선택 수보다 작을 수 없습니다.`,
            );
          }

          const rawOptions = Array.isArray(
            rawGroup?.options,
          )
            ? rawGroup.options
            : [];

          const options = rawOptions.map(
            (rawOption: any, optionIndex: number) => {
              const optionName = String(
                rawOption?.name || "",
              ).trim();

              if (!optionName) {
                throw new Error(
                  `${name} / ${groupName}: 옵션 이름은 비워둘 수 없습니다.`,
                );
              }

              const priceDelta = Number(
                rawOption?.priceDelta ??
                  rawOption?.price_delta ??
                  0,
              );

              if (!Number.isFinite(priceDelta)) {
                throw new Error(
                  `${name} / ${groupName} / ${optionName}: 추가 금액이 올바르지 않습니다.`,
                );
              }

              return {
                name: optionName,
                price_delta: Number(
                  priceDelta.toFixed(2),
                ),
                is_available:
                  !(
                    rawOption?.soldOut === true ||
                    rawOption?.sold_out === true ||
                    rawOption?.is_available === false
                  ),
                display_order: optionIndex,
              };
            },
          );

          return {
            name: groupName,
            is_required: required || minSelect > 0,
            min_select: minSelect,
            max_select: maxSelect,
            display_order: groupIndex,
            options,
          };
        },
      );

      /*
       * 현재 UI는 DB row id를 편집 state에서 유지하지 않으므로
       * 해당 메뉴의 옵션 그룹을 안전하게 다시 생성합니다.
       */
      const {
        data: existingGroups,
        error: existingGroupsError,
      } = await supabase
        .from("business_menu_option_groups")
        .select("id")
        .eq("business_id", businessId)
        .eq("menu_item_id", itemId);

      if (existingGroupsError) {
        throw existingGroupsError;
      }

      const existingGroupIds = (
        existingGroups || []
      )
        .map((row) => Number(row.id))
        .filter(
          (value) =>
            Number.isInteger(value) && value > 0,
        );

      if (existingGroupIds.length > 0) {
        const { error: deleteOptionsError } =
          await supabase
            .from("business_menu_option_items")
            .delete()
            .eq("business_id", businessId)
            .in(
              "option_group_id",
              existingGroupIds,
            );

        if (deleteOptionsError) {
          throw deleteOptionsError;
        }
      }

      const { error: deleteGroupsError } =
        await supabase
          .from("business_menu_option_groups")
          .delete()
          .eq("business_id", businessId)
          .eq("menu_item_id", itemId);

      if (deleteGroupsError) {
        throw deleteGroupsError;
      }

      for (const group of normalizedGroups) {
        const {
          data: insertedGroup,
          error: insertGroupError,
        } = await supabase
          .from("business_menu_option_groups")
          .insert({
            business_id: businessId,
            menu_item_id: itemId,
            name: group.name,
            is_required: group.is_required,
            min_select: group.min_select,
            max_select: group.max_select,
            display_order: group.display_order,
          })
          .select("id")
          .single();

        if (insertGroupError) {
          throw insertGroupError;
        }

        updatedOptionGroups += 1;

        if (group.options.length > 0) {
          const optionRows = group.options.map(
            (option: {
              name: string;
              price_delta: number;
              is_available: boolean;
              display_order: number;
            }) => ({
              business_id: businessId,
              option_group_id:
                Number(insertedGroup.id),
              name: option.name,
              price_delta: option.price_delta,
              is_available:
                option.is_available,
              display_order:
                option.display_order,
            }),
          );

          const { error: insertOptionsError } =
            await supabase
              .from("business_menu_option_items")
              .insert(optionRows);

          if (insertOptionsError) {
            throw insertOptionsError;
          }

          updatedOptionItems += optionRows.length;
        }
      }
    }

    return NextResponse.json({
      success: true,
      updatedCategories,
      updatedItems,
      updatedOptionGroups,
      updatedOptionItems,
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
    const action = String(body?.action || "");
    const supabase = getSupabaseAdmin();

    if (
      action === "delete-menu-item" ||
      body?.itemId !== undefined
    ) {
      const itemId = Number(body?.itemId);

      if (
        !Number.isInteger(itemId) ||
        itemId <= 0
      ) {
        return NextResponse.json(
          { error: "잘못된 메뉴 ID입니다." },
          { status: 400 },
        );
      }

      const { data: item, error: itemError } =
        await supabase
          .from("business_menu_items")
          .select(
            "id,thumbnail_path,image_path",
          )
          .eq("business_id", businessId)
          .eq("id", itemId)
          .maybeSingle();

      if (itemError) throw itemError;

      if (!item) {
        return NextResponse.json(
          { error: "메뉴를 찾지 못했습니다." },
          { status: 404 },
        );
      }

      /*
       * option_groups는 menu_item_id FK가 ON DELETE CASCADE이고,
       * option_items도 option_group_id FK가 ON DELETE CASCADE이므로
       * 메뉴 삭제만으로 옵션도 함께 삭제됩니다.
       */
      const { error: deleteError } = await supabase
        .from("business_menu_items")
        .delete()
        .eq("business_id", businessId)
        .eq("id", itemId);

      if (deleteError) throw deleteError;

      const storagePaths = [
        item.thumbnail_path,
        item.image_path,
      ].filter(
        (value): value is string =>
          typeof value === "string" &&
          value.length > 0 &&
          !value.startsWith("http://") &&
          !value.startsWith("https://"),
      );

      if (storagePaths.length > 0) {
        const { error: storageError } =
          await supabase.storage
            .from("menu-images")
            .remove(storagePaths);

        if (storageError) {
          console.warn(
            "MENU IMAGE CLEANUP WARNING:",
            storageError,
          );
        }
      }

      return NextResponse.json({
        success: true,
        deletedItemId: itemId,
      });
    }

    const categoryId = Number(body?.categoryId);

    if (
      !Number.isInteger(categoryId) ||
      categoryId <= 0
    ) {
      return NextResponse.json(
        { error: "잘못된 카테고리 ID입니다." },
        { status: 400 },
      );
    }

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
    console.error("OWNER MENU DELETE ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "삭제하지 못했습니다.",
      },
      { status: 500 },
    );
  }
}