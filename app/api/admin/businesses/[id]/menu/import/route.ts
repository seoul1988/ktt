import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { requireBusinessApiAccess } from "@/lib/requireBusinessApiAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UnifiedOptionItem = {
  name: string;
  priceDelta: number;
  soldOut: boolean;
  displayOrder: number;
};

type UnifiedOptionGroup = {
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number | null;
  displayOrder: number;
  options: UnifiedOptionItem[];
};

function getSupabaseAdmin() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

function safeFileStem(value: string) {
  return (
    String(value || "menu")
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9가-힣-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100) || "menu"
  );
}

function normalizePlatform(value: FormDataEntryValue | null) {
  const platform = String(value || "manual").trim().toLowerCase();
  if (platform === "doordash" || platform === "clover" || platform === "chownow") {
    return platform;
  }
  return "manual";
}

function finiteNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeOptionGroups(raw: unknown): UnifiedOptionGroup[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((groupValue, groupIndex) => {
      if (!groupValue || typeof groupValue !== "object" || Array.isArray(groupValue)) {
        return null;
      }

      const group = groupValue as Record<string, unknown>;
      const groupName = String(
        group.name ?? group.group_name ?? `Options ${groupIndex + 1}`,
      ).trim();

      if (!groupName) return null;

      const minSelect = Math.max(
        0,
        Math.trunc(finiteNumber(group.minSelect ?? group.min_select, 0)),
      );

      const rawMax = group.maxSelect ?? group.max_select;
      const maxSelect =
        rawMax === null || rawMax === undefined || rawMax === ""
          ? null
          : Math.max(0, Math.trunc(finiteNumber(rawMax, 0)));

      const rawOptions = Array.isArray(group.options) ? group.options : [];
      const options: UnifiedOptionItem[] = rawOptions
        .map((optionValue, optionIndex) => {
          if (!optionValue || typeof optionValue !== "object" || Array.isArray(optionValue)) {
            return null;
          }

          const option = optionValue as Record<string, unknown>;
          const optionName = String(
            option.name ?? option.option_name ?? `Option ${optionIndex + 1}`,
          ).trim();

          if (!optionName) return null;

          return {
            name: optionName,
            priceDelta: finiteNumber(
              option.priceDelta ?? option.price_delta ?? option.price,
              0,
            ),
            soldOut: Boolean(option.soldOut ?? option.sold_out ?? false),
            displayOrder: Math.max(
              0,
              Math.trunc(
                finiteNumber(
                  option.displayOrder ?? option.display_order,
                  optionIndex,
                ),
              ),
            ),
          } satisfies UnifiedOptionItem;
        })
        .filter((value): value is UnifiedOptionItem => Boolean(value));

      return {
        name: groupName,
        required: Boolean(
          group.required ?? group.is_required ?? minSelect > 0,
        ),
        minSelect,
        maxSelect,
        displayOrder: Math.max(
          0,
          Math.trunc(
            finiteNumber(
              group.displayOrder ?? group.display_order,
              groupIndex,
            ),
          ),
        ),
        options,
      } satisfies UnifiedOptionGroup;
    })
    .filter((value): value is UnifiedOptionGroup => Boolean(value));
}

function parseOptionGroups(formData: FormData) {
  const raw = String(
    formData.get("optionGroupsJson") ||
      formData.get("optionsJson") ||
      "[]",
  ).trim();

  if (!raw) return [];

  try {
    return normalizeOptionGroups(JSON.parse(raw));
  } catch {
    throw new Error("옵션 JSON 형식이 올바르지 않습니다.");
  }
}

async function uploadWebp(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  businessId: number,
  folder: "thumbnails" | "display",
  file: File | null,
  stem: string,
) {
  if (!file || file.size === 0) return null;

  const path =
    `${businessId}/${folder}/${Date.now()}-` +
    `${crypto.randomUUID()}-${stem}.webp`;

  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from("menu-images")
    .upload(path, bytes, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: false,
    });

  if (error) {
    throw new Error(`${folder} upload failed: ${error.message}`);
  }

  return path;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
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

    const access = await requireBusinessApiAccess(businessId);
    if (!access.ok) return access.response;

    const formData = await request.formData();

    const sourcePlatform = normalizePlatform(
      formData.get("sourcePlatform") || formData.get("platform"),
    );

    const category =
      String(formData.get("category") || "Menu").trim() || "Menu";

    const name = String(formData.get("name") || "").trim();
    const description = String(formData.get("description") || "").trim();

    const rawPrice = String(formData.get("price") || "").trim();
    const price = rawPrice ? Number(rawPrice) : null;

    const soldOut = String(formData.get("soldOut") || "false") === "true";

    const displayOrder = Math.max(
      0,
      Number(formData.get("displayOrder") || 0) || 0,
    );

    const replaceExisting =
      String(formData.get("replaceExisting") || "false") === "true";

    const optionGroups = parseOptionGroups(formData);

    const thumbnailValue = formData.get("thumbnail");
    const displayImageValue = formData.get("displayImage");

    const thumbnail = thumbnailValue instanceof File ? thumbnailValue : null;
    const displayImage =
      displayImageValue instanceof File ? displayImageValue : null;

    if (!name) {
      return NextResponse.json(
        { error: "Menu name is required" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();

    if (replaceExisting) {
      const { data: oldItems, error: oldItemsError } = await supabase
        .from("business_menu_items")
        .select("id,thumbnail_path,image_path")
        .eq("business_id", businessId);

      if (oldItemsError) throw oldItemsError;

      const oldPaths = (oldItems || [])
        .flatMap((item) => [item.thumbnail_path, item.image_path])
        .filter(
          (value): value is string =>
            typeof value === "string" && value.length > 0,
        );

      // 옵션 테이블은 menu item과 cascade로 지워지지만,
      // business_id 기준으로 먼저 지워 두면 이전 데이터도 안전하게 정리됩니다.
      const { error: optionGroupDeleteError } = await supabase
        .from("business_menu_option_groups")
        .delete()
        .eq("business_id", businessId);

      if (optionGroupDeleteError) {
        // 테이블을 아직 만들지 않았다면 더 명확한 오류를 보여줍니다.
        throw new Error(
          `옵션 그룹 삭제 실패: ${optionGroupDeleteError.message}. ` +
            "먼저 공통 옵션 테이블 SQL을 실행하세요.",
        );
      }

      if (oldPaths.length) {
        const { error: removeError } = await supabase.storage
          .from("menu-images")
          .remove(oldPaths);
        if (removeError) {
          console.warn("old menu image cleanup warning:", removeError.message);
        }
      }

      const { error: deleteError } = await supabase
        .from("business_menu_categories")
        .delete()
        .eq("business_id", businessId);

      if (deleteError) throw deleteError;
    }

    const { data: categoryRow, error: categoryError } = await supabase
      .from("business_menu_categories")
      .upsert(
        {
          business_id: businessId,
          name: category,
          display_order: displayOrder,
          is_active: true,
        },
        { onConflict: "business_id,name" },
      )
      .select("id")
      .single();

    if (categoryError || !categoryRow) {
      throw new Error(categoryError?.message || "Category save failed");
    }

    const stem = safeFileStem(name);

    let thumbnailPath: string | null = null;
    let imagePath: string | null = null;

    try {
      thumbnailPath = await uploadWebp(
        supabase,
        businessId,
        "thumbnails",
        thumbnail,
        stem,
      );

      imagePath = await uploadWebp(
        supabase,
        businessId,
        "display",
        displayImage,
        stem,
      );
    } catch (error) {
      const uploaded = [thumbnailPath, imagePath].filter(
        (value): value is string => Boolean(value),
      );

      if (uploaded.length) {
        await supabase.storage.from("menu-images").remove(uploaded);
      }

      throw error;
    }

    const { data: menuItem, error: menuError } = await supabase
      .from("business_menu_items")
      .insert({
        business_id: businessId,
        category_id: categoryRow.id,
        name,
        description,
        price: Number.isFinite(price) ? price : null,
        thumbnail_path: thumbnailPath,
        image_path: imagePath,
        display_order: displayOrder,
        is_available: !soldOut,
        source_platform: sourcePlatform,
      })
      .select("id")
      .single();

    if (menuError || !menuItem) {
      const uploaded = [thumbnailPath, imagePath].filter(
        (value): value is string => Boolean(value),
      );

      if (uploaded.length) {
        await supabase.storage.from("menu-images").remove(uploaded);
      }

      throw new Error(menuError?.message || "Menu item save failed");
    }

    let optionGroupCount = 0;
    let optionItemCount = 0;

    try {
      for (const group of optionGroups) {
        const { data: groupRow, error: groupError } = await supabase
          .from("business_menu_option_groups")
          .insert({
            business_id: businessId,
            menu_item_id: menuItem.id,
            name: group.name,
            is_required: group.required,
            min_select: group.minSelect,
            max_select: group.maxSelect,
            display_order: group.displayOrder,
          })
          .select("id")
          .single();

        if (groupError || !groupRow) {
          throw new Error(
            groupError?.message || `Option group save failed: ${group.name}`,
          );
        }

        optionGroupCount += 1;

        if (group.options.length > 0) {
          const optionRows = group.options.map((option) => ({
            business_id: businessId,
            option_group_id: groupRow.id,
            name: option.name,
            price_delta: option.priceDelta,
            is_available: !option.soldOut,
            display_order: option.displayOrder,
          }));

          const { error: optionsError } = await supabase
            .from("business_menu_option_items")
            .insert(optionRows);

          if (optionsError) {
            throw new Error(
              `Option items save failed (${group.name}): ${optionsError.message}`,
            );
          }

          optionItemCount += optionRows.length;
        }
      }
    } catch (optionError) {
      // 옵션 저장 실패 시 메뉴 하나만 남는 반쪽 데이터를 만들지 않습니다.
      await supabase
        .from("business_menu_items")
        .delete()
        .eq("id", menuItem.id)
        .eq("business_id", businessId);

      const uploaded = [thumbnailPath, imagePath].filter(
        (value): value is string => Boolean(value),
      );
      if (uploaded.length) {
        await supabase.storage.from("menu-images").remove(uploaded);
      }

      throw optionError;
    }

    return NextResponse.json({
      ok: true,
      itemId: menuItem.id,
      categoryId: categoryRow.id,
      sourcePlatform,
      optionGroupCount,
      optionItemCount,
      thumbnailPath,
      imagePath,
      originalUploaded: false,
    });
  } catch (error) {
    console.error("Menu import failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Menu import failed",
      },
      { status: 500 },
    );
  }
}