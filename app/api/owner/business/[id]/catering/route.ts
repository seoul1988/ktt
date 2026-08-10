import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBusinessManagementAccess } from "@/lib/requireBusinessManagementAccess";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase 환경변수가 없습니다.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function getBusinessId(context: RouteContext) {
  const { id } = await context.params;
  const businessId = Number(id);

  if (!Number.isInteger(businessId) || businessId <= 0) {
    throw new Error("잘못된 business id 입니다.");
  }

  await requireBusinessManagementAccess(businessId);
  return businessId;
}

function normalizeItem(input: any, businessId: number) {
  const pricingType = String(input.pricing_type ?? "fixed");
  const allowedPricingTypes = [
    "fixed",
    "package",
    "per_person",
    "per_item",
    "quote",
  ];

  if (!allowedPricingTypes.includes(pricingType)) {
    throw new Error("잘못된 가격 방식입니다.");
  }

  const name = String(input.name ?? "").trim();

  if (!name) {
    throw new Error("메뉴 이름을 입력하세요.");
  }

  return {
    business_id: businessId,
    category_id:
      input.category_id == null
        ? null
        : Number(input.category_id),
    name,
    description: String(input.description ?? "").trim(),
    image_url:
      typeof input.image_url === "string" &&
      input.image_url.trim()
        ? input.image_url.trim()
        : null,
    image_path:
      typeof input.image_path === "string" &&
      input.image_path.trim()
        ? input.image_path.trim()
        : null,
    pricing_type: pricingType,
    base_price:
      pricingType === "quote" || pricingType === "package"
        ? null
        : Math.max(0, Number(input.base_price ?? 0)),
    minimum_quantity: Math.max(
      1,
      Math.floor(Number(input.minimum_quantity ?? 1)),
    ),
    advance_notice_hours:
      input.advance_notice_hours == null
        ? null
        : Math.max(
            0,
            Math.floor(Number(input.advance_notice_hours)),
          ),
    pickup_enabled: Boolean(input.pickup_enabled),
    delivery_enabled: Boolean(input.delivery_enabled),
    delivery_fee: Boolean(input.delivery_enabled)
      ? Math.max(0, Number(input.delivery_fee ?? 0))
      : 0,
  };
}

async function replacePackages({
  supabase,
  businessId,
  itemId,
  packages,
}: {
  supabase: ReturnType<typeof getSupabase>;
  businessId: number;
  itemId: number;
  packages: any[];
}) {
  const deleted = await supabase
    .from("business_catering_packages")
    .delete()
    .eq("business_id", businessId)
    .eq("item_id", itemId);

  if (deleted.error) throw deleted.error;

  if (!packages.length) return;

  const rows = packages
    .filter((pkg) => String(pkg.package_name ?? "").trim())
    .map((pkg, index) => ({
      business_id: businessId,
      item_id: itemId,
      package_name: String(pkg.package_name ?? "").trim(),
      serving_label:
        typeof pkg.serving_label === "string" &&
        pkg.serving_label.trim()
          ? pkg.serving_label.trim()
          : null,
      price: Math.max(0, Number(pkg.price ?? 0)),
      minimum_quantity: 1,
      sort_order: index,
      is_active: true,
    }));

  if (!rows.length) return;

  const inserted = await supabase
    .from("business_catering_packages")
    .insert(rows);

  if (inserted.error) throw inserted.error;
}


async function replaceOptionGroups({
  supabase,
  businessId,
  itemId,
  optionGroups,
}: {
  supabase: ReturnType<typeof getSupabase>;
  businessId: number;
  itemId: number;
  optionGroups: any[];
}) {
  const currentGroups = await supabase
    .from("business_catering_option_groups")
    .select("id")
    .eq("business_id", businessId)
    .eq("item_id", itemId);

  if (currentGroups.error) throw currentGroups.error;

  const currentGroupIds = (currentGroups.data ?? []).map(
    (group) => Number(group.id),
  );

  let oldImagePaths: string[] = [];

  if (currentGroupIds.length > 0) {
    const currentChoices = await supabase
      .from("business_catering_option_choices")
      .select("image_path")
      .in("group_id", currentGroupIds);

    if (currentChoices.error) throw currentChoices.error;

    oldImagePaths = (currentChoices.data ?? [])
      .map((choice) => String(choice.image_path ?? "").trim())
      .filter(Boolean);
  }

  const incomingImagePaths = new Set(
    optionGroups.flatMap((group) =>
      Array.isArray(group?.choices)
        ? group.choices
            .map((choice: any) =>
              String(choice?.image_path ?? "").trim(),
            )
            .filter(Boolean)
        : [],
    ),
  );

  const deletedGroups = await supabase
    .from("business_catering_option_groups")
    .delete()
    .eq("business_id", businessId)
    .eq("item_id", itemId);

  if (deletedGroups.error) throw deletedGroups.error;

  if (!optionGroups.length) return;

  for (let groupIndex = 0; groupIndex < optionGroups.length; groupIndex += 1) {
    const group = optionGroups[groupIndex];
    const groupName = String(group?.name ?? "").trim();

    if (!groupName) continue;

    const selectionType =
      group?.selection_type === "single" ? "single" : "multiple";

    const minSelect = Math.max(
      0,
      Math.floor(Number(group?.min_select ?? 0)),
    );

    let maxSelect = Math.max(
      0,
      Math.floor(Number(group?.max_select ?? 0)),
    );

    const choices = Array.isArray(group?.choices)
      ? group.choices.filter(
          (choice: any) =>
            String(choice?.name ?? "").trim().length > 0,
        )
      : [];

    if (selectionType === "single") {
      maxSelect = 1;
    } else if (maxSelect === 0) {
      maxSelect = choices.length;
    }

    if (maxSelect < minSelect) {
      maxSelect = minSelect;
    }

    const groupInsert = await supabase
      .from("business_catering_option_groups")
      .insert({
        business_id: businessId,
        item_id: itemId,
        name: groupName,
        description:
          typeof group?.description === "string" &&
          group.description.trim()
            ? group.description.trim()
            : null,
        selection_type: selectionType,
        min_select: minSelect,
        max_select: maxSelect,
        sort_order: groupIndex,
        is_active: true,
      })
      .select("id")
      .single();

    if (groupInsert.error) throw groupInsert.error;

    if (!choices.length) continue;

    const choiceRows = choices.map(
      (choice: any, choiceIndex: number) => {
        const chargeType = ["flat", "per_person", "per_item"].includes(
          String(choice?.charge_type ?? ""),
        )
          ? String(choice.charge_type)
          : "flat";

        return {
          business_id: businessId,
          group_id: groupInsert.data.id,
          name: String(choice.name).trim(),
          description:
            typeof choice?.description === "string" &&
            choice.description.trim()
              ? choice.description.trim()
              : null,
          price_delta: Math.max(
            0,
            Number(choice?.price_delta ?? 0),
          ),
          charge_type: chargeType,
          image_url:
            typeof choice?.image_url === "string" &&
            choice.image_url.trim()
              ? choice.image_url.trim()
              : null,
          image_path:
            typeof choice?.image_path === "string" &&
            choice.image_path.trim()
              ? choice.image_path.trim()
              : null,
          sort_order: choiceIndex,
          is_active: true,
        };
      },
    );

    const choiceInsert = await supabase
      .from("business_catering_option_choices")
      .insert(choiceRows);

    if (choiceInsert.error) throw choiceInsert.error;
  }

  const staleImagePaths = oldImagePaths.filter(
    (path) => !incomingImagePaths.has(path),
  );

  if (staleImagePaths.length > 0) {
    const removed = await supabase.storage
      .from("catering-images")
      .remove(staleImagePaths);

    if (removed.error) {
      console.warn(
        "STALE CATERING OPTION IMAGE CLEANUP ERROR:",
        removed.error,
      );
    }
  }
}


export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const businessId = await getBusinessId(context);
    const supabase = getSupabase();

    let { data: settings, error: settingsError } =
      await supabase
        .from("business_catering_settings")
        .select("*")
        .eq("business_id", businessId)
        .maybeSingle();

    if (settingsError) throw settingsError;

    if (!settings) {
      const inserted = await supabase
        .from("business_catering_settings")
        .insert({
          business_id: businessId,
          is_enabled: false,
          page_title: "Catering",
          minimum_order_amount: 0,
          minimum_order_people: 0,
          advance_notice_hours: 24,
          pickup_enabled: true,
          delivery_enabled: false,
          quote_enabled: true,
        })
        .select("*")
        .single();

      if (inserted.error) throw inserted.error;
      settings = inserted.data;
    }

    const [categoryResult, itemResult] =
      await Promise.all([
        supabase
          .from("business_catering_categories")
          .select("*")
          .eq("business_id", businessId)
          .order("sort_order", { ascending: true })
          .order("id", { ascending: true }),

        supabase
          .from("business_catering_items")
          .select(`
            *,
            packages:business_catering_packages(*),
            option_groups:business_catering_option_groups(
              *,
              choices:business_catering_option_choices(*)
            )
          `)
          .eq("business_id", businessId)
          .order("sort_order", { ascending: true })
          .order("id", { ascending: true }),
      ]);

    if (categoryResult.error) throw categoryResult.error;
    if (itemResult.error) throw itemResult.error;

    const items = (itemResult.data ?? []).map((item) => ({
      ...item,
      packages: [...(item.packages ?? [])].sort(
        (a, b) =>
          Number(a.sort_order ?? 0) -
            Number(b.sort_order ?? 0) ||
          Number(a.id) - Number(b.id),
      ),
      option_groups: [...(item.option_groups ?? [])]
        .sort(
          (a, b) =>
            Number(a.sort_order ?? 0) -
              Number(b.sort_order ?? 0) ||
            Number(a.id) - Number(b.id),
        )
        .map((group) => ({
          ...group,
          choices: [...(group.choices ?? [])].sort(
            (a, b) =>
              Number(a.sort_order ?? 0) -
                Number(b.sort_order ?? 0) ||
              Number(a.id) - Number(b.id),
          ),
        })),
    }));

    return NextResponse.json({
      settings,
      categories: categoryResult.data ?? [],
      items,
    });
  } catch (error) {
    console.error("CATERING GET ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "캐터링 정보를 불러오지 못했습니다.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const businessId = await getBusinessId(context);
    const supabase = getSupabase();
    const body = await request.json();

    if (body?.action === "category") {
      const input = body.category ?? {};
      const categoryId = Number(input.id);
      const name = String(input.name ?? "").trim();

      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        return NextResponse.json(
          { error: "수정할 카테고리 id가 없습니다." },
          { status: 400 },
        );
      }

      if (!name) {
        return NextResponse.json(
          { error: "카테고리 이름을 입력하세요." },
          { status: 400 },
        );
      }

      const existingCategory = await supabase
        .from("business_catering_categories")
        .select("id, name")
        .eq("business_id", businessId);

      if (existingCategory.error) throw existingCategory.error;

      const duplicate = (existingCategory.data ?? []).some(
        (category) =>
          Number(category.id) !== categoryId &&
          String(category.name ?? "").trim().toLowerCase() ===
            name.toLowerCase(),
      );

      if (duplicate) {
        return NextResponse.json(
          { error: `"${name}" 카테고리는 이미 등록되어 있습니다.` },
          { status: 409 },
        );
      }

      const { data, error } = await supabase
        .from("business_catering_categories")
        .update({
          name,
          description:
            typeof input.description === "string" && input.description.trim()
              ? input.description.trim()
              : null,
          sort_order: Math.max(
            0,
            Math.floor(Number(input.sort_order ?? 0)),
          ),
          is_active: Boolean(input.is_active),
        })
        .eq("id", categoryId)
        .eq("business_id", businessId)
        .select("*")
        .single();

      if (error) throw error;

      return NextResponse.json({ category: data });
    }

    if (body?.action === "settings") {
      const input = body.settings ?? {};

      const payload = {
        business_id: businessId,
        is_enabled: Boolean(input.is_enabled),
        page_title:
          typeof input.page_title === "string" &&
          input.page_title.trim()
            ? input.page_title.trim()
            : "Catering",
        page_subtitle:
          typeof input.page_subtitle === "string"
            ? input.page_subtitle.trim() || null
            : null,
        minimum_order_amount: Math.max(
          0,
          Number(input.minimum_order_amount ?? 0),
        ),
        minimum_order_people: Math.max(
          0,
          Math.floor(Number(input.minimum_order_people ?? 0)),
        ),
        advance_notice_hours: Math.max(
          0,
          Math.floor(Number(input.advance_notice_hours ?? 24)),
        ),
        pickup_enabled: Boolean(input.pickup_enabled),
        delivery_enabled: Boolean(input.delivery_enabled),
        quote_enabled: Boolean(input.quote_enabled),
      };

      const { data, error } = await supabase
        .from("business_catering_settings")
        .upsert(payload, {
          onConflict: "business_id",
        })
        .select("*")
        .single();

      if (error) throw error;

      return NextResponse.json({ settings: data });
    }

    if (body?.action === "item") {
      const itemId = Number(body?.item?.id);

      if (!Number.isInteger(itemId) || itemId <= 0) {
        return NextResponse.json(
          { error: "수정할 메뉴 id가 없습니다." },
          { status: 400 },
        );
      }

      const payload = normalizeItem(
        body.item,
        businessId,
      );

      const { data, error } = await supabase
        .from("business_catering_items")
        .update(payload)
        .eq("id", itemId)
        .eq("business_id", businessId)
        .select("*")
        .single();

      if (error) throw error;

      const packages =
        payload.pricing_type === "package" &&
        Array.isArray(body.packages)
          ? body.packages
          : [];

      await replacePackages({
        supabase,
        businessId,
        itemId,
        packages,
      });

      const optionGroups = Array.isArray(body.option_groups)
        ? body.option_groups
        : [];

      await replaceOptionGroups({
        supabase,
        businessId,
        itemId,
        optionGroups,
      });

      return NextResponse.json({ item: data });
    }

    return NextResponse.json(
      { error: "지원하지 않는 작업입니다." },
      { status: 400 },
    );
  } catch (error) {
    console.error("CATERING PATCH ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "캐터링 정보를 저장하지 못했습니다.",
      },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const businessId = await getBusinessId(context);
    const supabase = getSupabase();
    const body = await request.json();

    if (body?.action === "category") {
      const name = String(
        body?.category?.name ?? "",
      ).trim();

      if (!name) {
        return NextResponse.json(
          { error: "카테고리 이름을 입력하세요." },
          { status: 400 },
        );
      }

      const existingCategory = await supabase
        .from("business_catering_categories")
        .select("id, name")
        .eq("business_id", businessId);

      if (existingCategory.error) {
        throw existingCategory.error;
      }

      const duplicate = (existingCategory.data ?? []).some(
        (category) =>
          String(category.name ?? "")
            .trim()
            .toLowerCase() === name.toLowerCase(),
      );

      if (duplicate) {
        return NextResponse.json(
          { error: `"${name}" 카테고리는 이미 등록되어 있습니다.` },
          { status: 409 },
        );
      }

      const { data: last } = await supabase
        .from("business_catering_categories")
        .select("sort_order")
        .eq("business_id", businessId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      const requestedSortOrder =
        body?.category?.sort_order == null
          ? Number(last?.sort_order ?? -1) + 1
          : Math.max(
              0,
              Math.floor(
                Number(body.category.sort_order),
              ),
            );

      const { data, error } = await supabase
        .from("business_catering_categories")
        .insert({
          business_id: businessId,
          name,
          description:
            typeof body?.category?.description === "string" &&
            body.category.description.trim()
              ? body.category.description.trim()
              : null,
          sort_order: requestedSortOrder,
          is_active:
            body?.category?.is_active === false
              ? false
              : true,
        })
        .select("*")
        .single();

      if (error) throw error;

      return NextResponse.json({
        category: data,
      });
    }

    if (body?.action === "item") {
      const payload = normalizeItem(
        body.item ?? {},
        businessId,
      );

      const { data: last } = await supabase
        .from("business_catering_items")
        .select("sort_order")
        .eq("business_id", businessId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      const insertItem = await supabase
        .from("business_catering_items")
        .insert({
          ...payload,
          is_active: true,
          sort_order:
            Number(last?.sort_order ?? -1) + 1,
        })
        .select("*")
        .single();

      if (insertItem.error) {
        throw insertItem.error;
      }

      const createdItem = insertItem.data;

      try {
        const packages =
          payload.pricing_type === "package" &&
          Array.isArray(body.packages)
            ? body.packages
            : [];

        await replacePackages({
          supabase,
          businessId,
          itemId: createdItem.id,
          packages,
        });

        const optionGroups = Array.isArray(body.option_groups)
          ? body.option_groups
          : [];

        await replaceOptionGroups({
          supabase,
          businessId,
          itemId: createdItem.id,
          optionGroups,
        });
      } catch (packageError) {
        await supabase
          .from("business_catering_items")
          .delete()
          .eq("id", createdItem.id)
          .eq("business_id", businessId);

        throw packageError;
      }

      return NextResponse.json({
        item: createdItem,
      });
    }

    return NextResponse.json(
      { error: "지원하지 않는 작업입니다." },
      { status: 400 },
    );
  } catch (error) {
    console.error("CATERING POST ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "캐터링 정보를 저장하지 못했습니다.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const businessId = await getBusinessId(context);
    const supabase = getSupabase();

    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const id = Number(
      url.searchParams.get("id"),
    );

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "잘못된 id 입니다." },
        { status: 400 },
      );
    }

    if (type === "category") {
      const clearResult = await supabase
        .from("business_catering_items")
        .update({ category_id: null })
        .eq("business_id", businessId)
        .eq("category_id", id);

      if (clearResult.error) {
        throw clearResult.error;
      }

      const { error } = await supabase
        .from("business_catering_categories")
        .delete()
        .eq("id", id)
        .eq("business_id", businessId);

      if (error) throw error;

      return NextResponse.json({ ok: true });
    }

    if (type === "item") {
      const { data: item, error: readError } =
        await supabase
          .from("business_catering_items")
          .select("image_path")
          .eq("id", id)
          .eq("business_id", businessId)
          .maybeSingle();

      if (readError) throw readError;

      const groupResult = await supabase
        .from("business_catering_option_groups")
        .select("id")
        .eq("business_id", businessId)
        .eq("item_id", id);

      if (groupResult.error) throw groupResult.error;

      const groupIds = (groupResult.data ?? []).map(
        (group) => Number(group.id),
      );

      let optionImagePaths: string[] = [];

      if (groupIds.length > 0) {
        const choiceResult = await supabase
          .from("business_catering_option_choices")
          .select("image_path")
          .in("group_id", groupIds);

        if (choiceResult.error) throw choiceResult.error;

        optionImagePaths = (choiceResult.data ?? [])
          .map((choice) =>
            String(choice.image_path ?? "").trim(),
          )
          .filter(Boolean);
      }

      const { error } = await supabase
        .from("business_catering_items")
        .delete()
        .eq("id", id)
        .eq("business_id", businessId);

      if (error) throw error;

      const storagePaths = [
        ...(item?.image_path ? [item.image_path] : []),
        ...optionImagePaths,
      ];

      if (storagePaths.length > 0) {
        const removeResult = await supabase.storage
          .from("catering-images")
          .remove(storagePaths);

        if (removeResult.error) {
          console.warn(
            "CATERING IMAGE CLEANUP ERROR:",
            removeResult.error,
          );
        }
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: "지원하지 않는 삭제 작업입니다." },
      { status: 400 },
    );
  } catch (error) {
    console.error("CATERING DELETE ERROR:", error);

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
