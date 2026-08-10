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


function normalizeMenuMatchName(value: unknown) {
  return String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, " and ")
    // ChowNow와 기존 KTown 메뉴에서 같은 의미로 쓰이는 표현만 통일합니다.
    .replace(/\bbuild\b/g, "create")
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMenuCompactName(value: unknown) {
  // "Hot Dog" ↔ "HOTDOG", "B.L.T." ↔ "BLT"처럼
  // 공백/점/하이픈 차이만 있는 메뉴 이름을 안전하게 같은 이름으로 봅니다.
  return normalizeMenuMatchName(value).replace(/\s+/g, "");
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

function normalizeOptionMatchName(value: unknown) {
  return String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/^select\s+/i, "")
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseImportedOptionGroupMeta(
  rawGroupName: unknown,
  rawRuleText: unknown,
  fallbackRequired: boolean,
  fallbackMin: number,
  fallbackMax: number | null,
) {
  const groupText = String(rawGroupName || "").replace(/\s+/g, " ").trim();
  const ruleText = String(rawRuleText || "").replace(/\s+/g, " ").trim();
  const source = ruleText || groupText;
  const marker = source.match(/\b(REQUIRED|OPTIONAL)\b/i);

  let name = groupText || "Options";
  let required = fallbackRequired;
  let minSelect = Math.max(0, fallbackMin);
  let maxSelect = fallbackMax == null ? null : Math.max(0, fallbackMax);

  if (marker && marker.index != null) {
    const beforeMarker = source.slice(0, marker.index).trim();
    if (beforeMarker) name = beforeMarker;

    required = marker[1].toUpperCase() === "REQUIRED";
    if (required && minSelect === 0) minSelect = 1;

    const afterMarker = source.slice(marker.index + marker[0].length).trim();
    const upTo = afterMarker.match(/(?:\(|\b)UP\s+TO\s+(\d+)(?:\)|\b)/i);
    if (upTo) {
      maxSelect = Math.max(0, Number(upTo[1]));
      if (!required) minSelect = 0;
    }

    const range = afterMarker.match(/^(?:\(?\s*)?(\d+)\s*(?:-|–|TO)\s*(\d+)(?:\s*\)?)?/i);
    if (range) {
      minSelect = Math.max(0, Number(range[1]));
      maxSelect = Math.max(minSelect, Number(range[2]));
      required = minSelect > 0;
    }
  }

  name = name.split(/\b(?:REQUIRED|OPTIONAL)\b/i)[0].trim() || "Options";
  return { name, required, minSelect, maxSelect };
}

function normalizeOptionGroups(raw: unknown): UnifiedOptionGroup[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((groupValue, groupIndex) => {
      if (!groupValue || typeof groupValue !== "object" || Array.isArray(groupValue)) {
        return null;
      }

      const group = groupValue as Record<string, unknown>;
      const rawGroupName = String(
        group.name ?? group.group_name ?? `Options ${groupIndex + 1}`,
      ).trim();

      if (!rawGroupName) return null;

      const rawMinSelect = Math.max(
        0,
        Math.trunc(finiteNumber(group.minSelect ?? group.min_select, 0)),
      );

      const rawMax = group.maxSelect ?? group.max_select;
      const rawMaxSelect =
        rawMax === null || rawMax === undefined || rawMax === ""
          ? null
          : Math.max(0, Math.trunc(finiteNumber(rawMax, 0)));

      const rawRequired = Boolean(
        group.required ?? group.is_required ?? rawMinSelect > 0,
      );

      const groupMeta = parseImportedOptionGroupMeta(
        rawGroupName,
        group.ruleText ?? group.rule_text,
        rawRequired,
        rawMinSelect,
        rawMaxSelect,
      );
      const groupName = groupMeta.name;
      const minSelect = groupMeta.minSelect;
      const maxSelect = groupMeta.maxSelect;

      const rawOptions = Array.isArray(group.options) ? group.options : [];
      const options: UnifiedOptionItem[] = rawOptions
        .map((optionValue, optionIndex) => {
          if (!optionValue || typeof optionValue !== "object" || Array.isArray(optionValue)) {
            return null;
          }

          const option = optionValue as Record<string, unknown>;
          const optionName = String(
            option.name ?? option.option_name ?? `Option ${optionIndex + 1}`,
          ).replace(/^Select\s+/i, "").trim();

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
        required: groupMeta.required,
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


type CategoryMenuMapRow = {
  name: string;
  category: string;
  categoryDisplayOrder: number;
  price: number | null;
};

function parseCategoryMenuMap(formData: FormData): CategoryMenuMapRow[] {
  const raw = String(formData.get("categoryMenuMapJson") || "").trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((row) => ({
        name: String(row?.name || "").trim(),
        category: String(row?.category || "").trim(),
        categoryDisplayOrder: Math.max(
          0,
          Math.trunc(finiteNumber(row?.categoryDisplayOrder, 0)),
        ),
        price:
          row?.price === null ||
          row?.price === undefined ||
          row?.price === ""
            ? null
            : finiteNumber(row?.price, 0),
      }))
      .filter((row) => row.name && row.category);
  } catch {
    return [];
  }
}

function normalizeLooseMenuName(value: unknown) {
  return String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\bbuild\b/g, "create")
    .replace(/\bthe\b/g, " ")
    .replace(/\bselect\b/g, " ")
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function menuTokenSet(value: unknown) {
  return new Set(
    normalizeLooseMenuName(value)
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length >= 2),
  );
}

function tokenSimilarity(a: unknown, b: unknown) {
  const aTokens = menuTokenSet(a);
  const bTokens = menuTokenSet(b);

  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) intersection += 1;
  }

  return (2 * intersection) / (aTokens.size + bTokens.size);
}

function findSingleExistingMenuMatch(
  existingItems: Array<{
    id: number;
    name: string;
    category_id?: number | null;
    price?: number | null;
  }>,
  requestedName: string,
  requestedPrice: number | null = null,
) {
  const requestedNameKey = normalizeMenuMatchName(requestedName);

  // 1) exact normalized match
  let matches = existingItems.filter(
    (item) => normalizeMenuMatchName(item.name) === requestedNameKey,
  );
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) return null;

  // 2) compact match: Hot Dog <-> HOTDOG, B.L.T. <-> BLT
  const requestedCompactKey = normalizeMenuCompactName(requestedName);
  if (requestedCompactKey.length >= 4) {
    matches = existingItems.filter(
      (item) =>
        normalizeMenuCompactName(item.name) === requestedCompactKey,
    );
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) return null;
  }

  // 3) containment for small wording differences.
  if (requestedNameKey.length >= 6) {
    const containmentMatches = existingItems.filter((item) => {
      const existingKey = normalizeMenuMatchName(item.name);
      if (existingKey.length < 5) return false;

      const contains =
        requestedNameKey.includes(existingKey) ||
        existingKey.includes(requestedNameKey);

      if (!contains) return false;

      const shorter = Math.min(existingKey.length, requestedNameKey.length);
      const longer = Math.max(existingKey.length, requestedNameKey.length);
      return longer > 0 && shorter / longer >= 0.62;
    });

    if (containmentMatches.length === 1) {
      return containmentMatches[0];
    }
  }

  // 4) token similarity. Use price as a strong tie-breaker when CSV menu price exists.
  const scored = existingItems
    .map((item) => {
      const similarity = tokenSimilarity(item.name, requestedName);

      let priceScore = 0;
      if (
        requestedPrice != null &&
        Number.isFinite(requestedPrice) &&
        item.price != null &&
        Number.isFinite(Number(item.price))
      ) {
        const diff = Math.abs(Number(item.price) - requestedPrice);
        if (diff <= 0.01) priceScore = 0.18;
        else if (diff <= 0.5) priceScore = 0.08;
        else if (diff > 2) priceScore = -0.12;
      }

      return {
        item,
        similarity,
        score: similarity + priceScore,
      };
    })
    .filter((entry) => entry.similarity >= 0.66)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;

  const best = scored[0];
  const second = scored[1];

  // Only accept a clearly unique fuzzy match.
  if (
    best.score >= 0.72 &&
    (!second || best.score - second.score >= 0.12)
  ) {
    return best.item;
  }

  return null;
}


async function syncFullCategoryMap(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  businessId: number,
  mapRows: CategoryMenuMapRow[],
) {
  if (!mapRows.length) {
    return {
      categoryCount: 0,
      addedMenuCount: 0,
      skippedExistingCount: 0,
      unmatchedMenuNames: [] as string[],
    };
  }

  // 1) CSV의 카테고리를 먼저 DB에 보장합니다.
  const categoryOrder = new Map<string, { name: string; order: number }>();

  for (const row of mapRows) {
    const categoryName = String(row.category || "").trim();
    if (!categoryName || categoryName.toLowerCase() === "menu") continue;

    const key = categoryName.toLowerCase();
    if (!categoryOrder.has(key)) {
      categoryOrder.set(key, {
        name: categoryName,
        order: row.categoryDisplayOrder,
      });
    }
  }

  const categoryIdByKey = new Map<string, number>();

  for (const [key, info] of categoryOrder) {
    const { data: existingCategory, error: categoryFindError } = await supabase
      .from("business_menu_categories")
      .select("id")
      .eq("business_id", businessId)
      .ilike("name", info.name)
      .maybeSingle();

    if (categoryFindError) {
      throw new Error(
        `카테고리 조회 실패 (${info.name}): ${categoryFindError.message}`,
      );
    }

    let categoryId: number;

    if (existingCategory) {
      categoryId = Number(existingCategory.id);

      const { error: updateCategoryError } = await supabase
        .from("business_menu_categories")
        .update({
          display_order: info.order,
          is_active: true,
        })
        .eq("business_id", businessId)
        .eq("id", categoryId);

      if (updateCategoryError) {
        throw new Error(
          `카테고리 업데이트 실패 (${info.name}): ${updateCategoryError.message}`,
        );
      }
    } else {
      const { data: insertedCategory, error: categoryInsertError } = await supabase
        .from("business_menu_categories")
        .insert({
          business_id: businessId,
          name: info.name,
          display_order: info.order,
          is_active: true,
        })
        .select("id")
        .single();

      if (categoryInsertError || !insertedCategory) {
        throw new Error(
          categoryInsertError?.message ||
            `카테고리 추가 실패: ${info.name}`,
        );
      }

      categoryId = Number(insertedCategory.id);
    }

    categoryIdByKey.set(key, categoryId);
  }

  let addedMenuCount = 0;
  let skippedExistingCount = 0;
  const unmatchedMenuNames: string[] = [];
  const handledKeys = new Set<string>();

  // 2) CSV의 category + menu_name 조합대로 처리합니다.
  for (const row of mapRows) {
    const menuName = String(row.name || "").trim();
    const categoryName = String(row.category || "").trim();

    if (!menuName || !categoryName || categoryName.toLowerCase() === "menu") {
      continue;
    }

    const targetCategoryId = categoryIdByKey.get(categoryName.toLowerCase());
    if (!targetCategoryId) continue;

    const uniqueKey =
      `${categoryName.toLowerCase()}::${menuName.toLowerCase()}`;

    // 옵션 CSV에는 같은 메뉴가 옵션 개수만큼 반복되므로 한 번만 처리합니다.
    if (handledKeys.has(uniqueKey)) continue;
    handledKeys.add(uniqueKey);

    // 2-A) 해당 카테고리에 같은 이름의 메뉴가 이미 있으면 SKIP
    const { data: alreadyInCategory, error: targetLookupError } = await supabase
      .from("business_menu_items")
      .select("id")
      .eq("business_id", businessId)
      .eq("category_id", targetCategoryId)
      .ilike("name", menuName)
      .limit(1);

    if (targetLookupError) {
      throw new Error(
        `카테고리 메뉴 조회 실패 (${categoryName} / ${menuName}): ${targetLookupError.message}`,
      );
    }

    if ((alreadyInCategory || []).length > 0) {
      skippedExistingCount += 1;
      continue;
    }

    // 2-B) 다른 기존 카테고리에 같은 메뉴가 있으면 그 메뉴 정보를 복사해서 새 카테고리에 추가
    const { data: sourceItems, error: sourceLookupError } = await supabase
      .from("business_menu_items")
      .select(
        "id,name,description,price,display_order,is_available",
      )
      .eq("business_id", businessId)
      .ilike("name", menuName)
      .order("id", { ascending: true })
      .limit(1);

    if (sourceLookupError) {
      throw new Error(
        `기존 메뉴 조회 실패 (${menuName}): ${sourceLookupError.message}`,
      );
    }

    const sourceItem = (sourceItems || [])[0] || null;

    // 기존 메뉴가 다른 카테고리에 있으면 그대로 복사합니다.
    if (sourceItem) {
      const { error: cloneError } = await supabase
        .from("business_menu_items")
        .insert({
          business_id: businessId,
          category_id: targetCategoryId,
          name: String(sourceItem.name || menuName),
          description: String(sourceItem.description || ""),
          price:
            sourceItem.price == null
              ? row.price
              : finiteNumber(sourceItem.price, row.price ?? 0),
          // 현재 business_menu_items 테이블에는 thumbnail_url 컬럼이 없으므로
          // 기존 메뉴 복사 시 이름/설명/가격/순서/활성 상태만 복사합니다.
          display_order: Math.max(
            0,
            Math.trunc(
              finiteNumber(
                sourceItem.display_order,
                row.categoryDisplayOrder,
              ),
            ),
          ),
          is_available:
            sourceItem.is_available == null
              ? true
              : Boolean(sourceItem.is_available),
        });

      if (cloneError) {
        throw new Error(
          `메뉴 복사 실패 (${menuName} → ${categoryName}): ${cloneError.message}`,
        );
      }

      addedMenuCount += 1;
      continue;
    }

    // 2-C) DB 어디에도 메뉴가 없으면 CSV 정보로 새 메뉴 생성
    // 옵션 CSV만 올린 경우 가격이 없을 수 있으므로 0/null을 안전하게 사용합니다.
    const { error: insertNewError } = await supabase
      .from("business_menu_items")
      .insert({
        business_id: businessId,
        category_id: targetCategoryId,
        name: menuName,
        description: "",
        price: row.price,
        // 이미지 컬럼은 건드리지 않습니다.
        display_order: row.categoryDisplayOrder,
        is_available: true,
      });

    if (insertNewError) {
      unmatchedMenuNames.push(menuName);
      throw new Error(
        `신규 메뉴 추가 실패 (${menuName} → ${categoryName}): ${insertNewError.message}`,
      );
    }

    addedMenuCount += 1;
  }

  return {
    categoryCount: categoryOrder.size,
    addedMenuCount,
    skippedExistingCount,
    unmatchedMenuNames: Array.from(new Set(unmatchedMenuNames)),
  };
}


async function pruneEmptyBusinessCategories(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  businessId: number,
) {
  const [
    { data: allCategories, error: allCategoriesError },
    { data: categoryItems, error: categoryItemsError },
  ] = await Promise.all([
    supabase
      .from("business_menu_categories")
      .select("id")
      .eq("business_id", businessId),
    supabase
      .from("business_menu_items")
      .select("category_id")
      .eq("business_id", businessId),
  ]);

  if (allCategoriesError) {
    throw new Error(
      `카테고리 정리 조회 실패: ${allCategoriesError.message}`,
    );
  }

  if (categoryItemsError) {
    throw new Error(
      `메뉴 카테고리 조회 실패: ${categoryItemsError.message}`,
    );
  }

  const usedCategoryIds = new Set(
    (categoryItems || [])
      .map((item) => Number(item.category_id))
      .filter((id) => Number.isInteger(id) && id > 0),
  );

  const emptyCategoryIds = (allCategories || [])
    .map((row) => Number(row.id))
    .filter(
      (id) =>
        Number.isInteger(id) &&
        id > 0 &&
        !usedCategoryIds.has(id),
    );

  if (emptyCategoryIds.length === 0) return 0;

  const { error: pruneError } = await supabase
    .from("business_menu_categories")
    .delete()
    .eq("business_id", businessId)
    .in("id", emptyCategoryIds);

  if (pruneError) {
    throw new Error(
      `사용하지 않는 기존 카테고리 삭제 실패: ${pruneError.message}`,
    );
  }

  return emptyCategoryIds.length;
}


function parseUniqueCategories(formData: FormData) {
  const raw = String(formData.get("uniqueCategoriesJson") || "").trim();
  if (!raw) return [] as string[];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [] as string[];

    const result: string[] = [];
    const seen = new Set<string>();

    for (const value of parsed) {
      const name = String(value || "").replace(/\s+/g, " ").trim();
      if (!name || name.toLowerCase() === "menu") continue;

      const key = name.toLowerCase();
      if (seen.has(key)) continue;

      seen.add(key);
      result.push(name);
    }

    return result;
  } catch {
    return [] as string[];
  }
}

async function ensureCsvCategoriesExist(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  businessId: number,
  categoryNames: string[],
) {
  const categoryIdByName = new Map<string, number>();

  // 현재 DB 카테고리 먼저 조회
  const { data: existingCategories, error: existingError } = await supabase
    .from("business_menu_categories")
    .select("id,name")
    .eq("business_id", businessId);

  if (existingError) {
    throw new Error(
      `기존 카테고리 조회 실패: ${existingError.message}`,
    );
  }

  for (const row of existingCategories || []) {
    const name = String(row.name || "").trim();
    if (!name) continue;
    categoryIdByName.set(name.toLowerCase(), Number(row.id));
  }

  // CSV에 있는 카테고리가 DB에 없으면 무조건 추가
  for (let index = 0; index < categoryNames.length; index += 1) {
    const name = categoryNames[index];
    const key = name.toLowerCase();

    if (categoryIdByName.has(key)) {
      // 기존 카테고리는 순서/활성 상태만 맞춰줍니다.
      const existingId = categoryIdByName.get(key)!;

      const { error: updateError } = await supabase
        .from("business_menu_categories")
        .update({
          display_order: index,
          is_active: true,
        })
        .eq("business_id", businessId)
        .eq("id", existingId);

      if (updateError) {
        throw new Error(
          `카테고리 업데이트 실패 (${name}): ${updateError.message}`,
        );
      }

      continue;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("business_menu_categories")
      .insert({
        business_id: businessId,
        name,
        display_order: index,
        is_active: true,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      throw new Error(
        insertError?.message ||
          `카테고리 추가 실패: ${name}`,
      );
    }

    categoryIdByName.set(key, Number(inserted.id));
  }

  return categoryIdByName;
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

    const optionsOnly =
      String(
        formData.get("optionsOnly") ||
          formData.get("optionOnly") ||
          "false",
      ) === "true";

    const syncExistingMenuOnly =
      String(formData.get("syncExistingMenuOnly") || "false") === "true";

    const categorySyncOnly =
      String(formData.get("categorySyncOnly") || "false") === "true";

    const pruneEmptyCategories =
      String(formData.get("pruneEmptyCategories") || "false") === "true";

    const categoryDisplayOrder = Math.max(
      0,
      Math.trunc(
        finiteNumber(formData.get("categoryDisplayOrder"), displayOrder),
      ),
    );

    const preserveExistingOptionPrices =
      String(formData.get("preserveExistingOptionPrices") || "false") === "true";

    const categoryMenuMap = parseCategoryMenuMap(formData);
    const uniqueCategories = parseUniqueCategories(formData);

    const optionGroups = parseOptionGroups(formData);

    const thumbnailValue = formData.get("thumbnail");
    const displayImageValue = formData.get("displayImage");

    const thumbnail = thumbnailValue instanceof File ? thumbnailValue : null;
    const displayImage =
      displayImageValue instanceof File ? displayImageValue : null;

    const supabase = getSupabaseAdmin();

    // 카테고리 전체 동기화는 옵션 저장과 완전히 분리해서 한 번만 수행합니다.
    // CSV의 모든 카테고리를 먼저 만들고 기존 메뉴를 category_id 기준으로 이동한 뒤,
    // 이동 완료 후 비어 있는 예전 카테고리만 정리합니다.
    if (categorySyncOnly) {
      const categoriesFromMap = categoryMenuMap
        .map((row) => String(row.category || "").trim())
        .filter(
          (name) =>
            Boolean(name) &&
            name.toLowerCase() !== "menu",
        );

      const categoryNames = Array.from(
        new Map(
          [...uniqueCategories, ...categoriesFromMap].map((name) => [
            name.toLowerCase(),
            name,
          ]),
        ).values(),
      );

      if (categoryNames.length === 0) {
        return NextResponse.json(
          { error: "CSV에서 카테고리를 찾지 못했습니다." },
          { status: 400 },
        );
      }

      // 1) 제일 먼저 CSV 카테고리를 전부 DB에 보장합니다.
      // 메뉴 이름 매치 성공 여부와 상관없이 무조건 실행됩니다.
      await ensureCsvCategoriesExist(
        supabase,
        businessId,
        categoryNames,
      );

      // 2) 그 다음에만 기존 메뉴를 CSV category로 이동합니다.
      const categorySyncResult =
        categoryMenuMap.length > 0
          ? await syncFullCategoryMap(
              supabase,
              businessId,
              categoryMenuMap,
            )
          : {
              categoryCount: categoryNames.length,
              addedMenuCount: 0,
              skippedExistingCount: 0,
              unmatchedMenuNames: [] as string[],
              duplicateMatchedMenuNames: [] as string[],
            };

      console.log("[CHOWNOW CATEGORY SYNC]", {
        businessId,
        csvCategories: categoryNames,
        categoryCount: categoryNames.length,
        addedMenuCount: categorySyncResult.addedMenuCount,
        skippedExistingCount: categorySyncResult.skippedExistingCount,
        unmatchedMenuNames:
          categorySyncResult.unmatchedMenuNames,
      });

      const { data: actualCategories, error: actualCategoriesError } =
        await supabase
          .from("business_menu_categories")
          .select("id,name,display_order,is_active")
          .eq("business_id", businessId)
          .order("display_order", { ascending: true })
          .order("id", { ascending: true });

      if (actualCategoriesError) {
        throw new Error(
          `DB 카테고리 확인 실패: ${actualCategoriesError.message}`,
        );
      }

      return NextResponse.json({
        ok: true,
        categorySyncOnly: true,
        csvCategoryCount: categoryNames.length,
        csvCategories: categoryNames,
        categoryCount: (actualCategories || []).length,
        categories: (actualCategories || []).map((row) =>
          String(row.name || ""),
        ),
        dbCategories: actualCategories || [],
        addedMenuCount:
          categorySyncResult.addedMenuCount,
        skippedExistingCount:
          categorySyncResult.skippedExistingCount,
        movedMenuCount: 0,
        unmatchedMenuNames:
          categorySyncResult.unmatchedMenuNames,
        duplicateMatchedMenuNames:
          categorySyncResult.duplicateMatchedMenuNames || [],
        prunedCategoryCount: 0,
      });
    }

    if (!name) {
      return NextResponse.json(
        { error: "Menu name is required" },
        { status: 400 },
      );
    }

    let fullCategorySyncResult = {
      categoryCount: 0,
      movedMenuCount: 0,
      unmatchedMenuNames: [] as string[],
    };

    // 이전 버전 호환: categoryMenuMapJson이 메뉴별 요청에 같이 들어온 경우만 처리합니다.
    // 새 WebsiteEditor는 categorySyncOnly 요청에서 이미 전체 카테고리를 먼저 동기화합니다.
    if (
      syncExistingMenuOnly &&
      categoryMenuMap.length > 0
    ) {
      fullCategorySyncResult = await syncFullCategoryMap(
        supabase,
        businessId,
        categoryMenuMap,
      );
    }

    // 기존 메뉴 유지 모드:
    // 메뉴 이름/가격/설명/이미지는 유지하고 카테고리 배치 + 옵션만 동기화합니다.
    if (optionsOnly || syncExistingMenuOnly) {
      const { data: existingItems, error: existingItemsError } = await supabase
        .from("business_menu_items")
        .select("id,category_id,name,price")
        .eq("business_id", businessId);

      if (existingItemsError) {
        throw new Error(`기존 메뉴 찾기 실패: ${existingItemsError.message}`);
      }

      const matchedItem = findSingleExistingMenuMatch(
        (existingItems || []).map((item) => ({
          id: Number(item.id),
          category_id:
            item.category_id == null ? null : Number(item.category_id),
          name: String(item.name || ""),
          price:
            item.price == null ? null : finiteNumber(item.price, 0),
        })),
        name,
        price,
      );

      let matches = matchedItem ? [matchedItem] : [];

      if (matches.length === 0) {
        // 메뉴가 없으면 오류로 중단하지 않고 이 항목만 건너뜁니다.
        return NextResponse.json({
          ok: true,
          optionsOnly: true,
          skipped: true,
          skipReason: "menu_not_found",
          requestedMenuName: name,
          sourcePlatform,
          optionGroupCount: 0,
          optionItemCount: 0,
          menuPreserved: true,
          fullCategorySync: fullCategorySyncResult,
        });
      }

      if (matches.length > 1) {
        // 같은 이름의 메뉴가 여러 개면 잘못된 메뉴에 옵션을 넣지 않도록
        // 이 항목만 안전하게 건너뜁니다.
        return NextResponse.json({
          ok: true,
          optionsOnly: true,
          skipped: true,
          skipReason: "multiple_menu_matches",
          requestedMenuName: name,
          matchedCount: matches.length,
          sourcePlatform,
          optionGroupCount: 0,
          optionItemCount: 0,
          menuPreserved: true,
          fullCategorySync: fullCategorySyncResult,
        });
      }

      const menuItemId = Number(matches[0].id);
      let syncedCategoryId: number | null = null;

      // CSV에 카테고리가 있으면 해당 카테고리를 만들거나 갱신하고,
      // 기존 메뉴의 category_id만 새 카테고리로 이동합니다.
      // 이름/가격/설명/이미지 등 메뉴 본체의 다른 값은 전혀 수정하지 않습니다.
      if (category) {
        const { data: categoryRow, error: categoryError } = await supabase
          .from("business_menu_categories")
          .upsert(
            {
              business_id: businessId,
              name: category,
              display_order: categoryDisplayOrder,
              is_active: true,
            },
            { onConflict: "business_id,name" },
          )
          .select("id")
          .single();

        if (categoryError || !categoryRow) {
          throw new Error(
            categoryError?.message ||
              `카테고리 저장 실패: ${category}`,
          );
        }

        syncedCategoryId = Number(categoryRow.id);

        const { error: moveCategoryError } = await supabase
          .from("business_menu_items")
          .update({ category_id: syncedCategoryId })
          .eq("business_id", businessId)
          .eq("id", menuItemId);

        if (moveCategoryError) {
          throw new Error(
            `메뉴 카테고리 이동 실패 (${name} → ${category}): ${moveCategoryError.message}`,
          );
        }
      }

      // 기존 옵션 그룹 구조는 전부 교체하지만, 사용자가 금액 업데이트를 원하지 않으면
      // 삭제 전에 기존 option price_delta를 읽어 두었다가 같은 옵션명에 다시 적용합니다.
      const existingPriceByGroupAndName = new Map<string, number>();
      const existingPriceByName = new Map<string, number>();

      if (preserveExistingOptionPrices) {
        const { data: oldGroups, error: oldGroupsError } = await supabase
          .from("business_menu_option_groups")
          .select("id,name")
          .eq("business_id", businessId)
          .eq("menu_item_id", menuItemId);

        if (oldGroupsError) {
          throw new Error(`기존 옵션 금액 조회 실패: ${oldGroupsError.message}`);
        }

        const oldGroupIds = (oldGroups || []).map((row) => Number(row.id)).filter(Number.isFinite);
        const oldGroupNameById = new Map(
          (oldGroups || []).map((row) => [Number(row.id), String(row.name || "")]),
        );

        if (oldGroupIds.length > 0) {
          const { data: oldOptionItems, error: oldOptionItemsError } = await supabase
            .from("business_menu_option_items")
            .select("option_group_id,name,price_delta")
            .eq("business_id", businessId)
            .in("option_group_id", oldGroupIds);

          if (oldOptionItemsError) {
            throw new Error(`기존 옵션 금액 조회 실패: ${oldOptionItemsError.message}`);
          }

          for (const oldOption of oldOptionItems || []) {
            const optionKey = normalizeOptionMatchName(oldOption.name);
            if (!optionKey) continue;
            const groupName = oldGroupNameById.get(Number(oldOption.option_group_id)) || "";
            const groupKey = normalizeOptionMatchName(groupName);
            const price = finiteNumber(oldOption.price_delta, 0);

            if (groupKey) {
              existingPriceByGroupAndName.set(`${groupKey}::${optionKey}`, price);
            }
            // 그룹 구조가 바뀌어도 옵션명이 같으면 기존 금액을 유지합니다.
            if (!existingPriceByName.has(optionKey)) {
              existingPriceByName.set(optionKey, price);
            }
          }
        }
      }

      const resolvePreservedOptionPrice = (groupName: string, optionName: string, incoming: number) => {
        if (!preserveExistingOptionPrices) return incoming;
        const groupKey = normalizeOptionMatchName(groupName);
        const optionKey = normalizeOptionMatchName(optionName);
        const exact = existingPriceByGroupAndName.get(`${groupKey}::${optionKey}`);
        if (exact !== undefined) return exact;
        const byName = existingPriceByName.get(optionKey);
        return byName !== undefined ? byName : 0;
      };

      // 기존 메뉴는 그대로 두고 이 메뉴의 기존 옵션 그룹/항목은 전부 삭제한 뒤 새 구조로 교체합니다.
      const { error: oldOptionDeleteError } = await supabase
        .from("business_menu_option_groups")
        .delete()
        .eq("business_id", businessId)
        .eq("menu_item_id", menuItemId);

      if (oldOptionDeleteError) {
        throw new Error(`기존 옵션 삭제 실패: ${oldOptionDeleteError.message}`);
      }

      let optionGroupCount = 0;
      let optionItemCount = 0;

      try {
        for (const group of optionGroups) {
          const { data: groupRow, error: groupError } = await supabase
            .from("business_menu_option_groups")
            .insert({
              business_id: businessId,
              menu_item_id: menuItemId,
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
              groupError?.message ||
                `Option group save failed: ${group.name}`,
            );
          }

          optionGroupCount += 1;

          if (group.options.length > 0) {
            const optionRows = group.options.map((option) => ({
              business_id: businessId,
              option_group_id: groupRow.id,
              name: option.name,
              // ChowNow 옵션 CSV의 additional_price / priceDelta 값을 그대로 저장합니다.
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
        // 실패해도 기존 메뉴 본체는 삭제하지 않습니다.
        await supabase
          .from("business_menu_option_groups")
          .delete()
          .eq("business_id", businessId)
          .eq("menu_item_id", menuItemId);

        throw optionError;
      }

      let prunedCategoryCount = 0;

      if (pruneEmptyCategories) {
        const [
          { data: allCategories, error: allCategoriesError },
          { data: categoryItems, error: categoryItemsError },
        ] = await Promise.all([
          supabase
            .from("business_menu_categories")
            .select("id")
            .eq("business_id", businessId),
          supabase
            .from("business_menu_items")
            .select("category_id")
            .eq("business_id", businessId),
        ]);

        if (allCategoriesError) {
          throw new Error(
            `카테고리 정리 조회 실패: ${allCategoriesError.message}`,
          );
        }

        if (categoryItemsError) {
          throw new Error(
            `메뉴 카테고리 조회 실패: ${categoryItemsError.message}`,
          );
        }

        const usedCategoryIds = new Set(
          (categoryItems || [])
            .map((item) => Number(item.category_id))
            .filter((id) => Number.isInteger(id) && id > 0),
        );

        const emptyCategoryIds = (allCategories || [])
          .map((row) => Number(row.id))
          .filter(
            (id) =>
              Number.isInteger(id) &&
              id > 0 &&
              !usedCategoryIds.has(id),
          );

        if (emptyCategoryIds.length > 0) {
          const { error: pruneError } = await supabase
            .from("business_menu_categories")
            .delete()
            .eq("business_id", businessId)
            .in("id", emptyCategoryIds);

          if (pruneError) {
            throw new Error(
              `사용하지 않는 기존 카테고리 삭제 실패: ${pruneError.message}`,
            );
          }

          prunedCategoryCount = emptyCategoryIds.length;
        }
      }

      return NextResponse.json({
        ok: true,
        optionsOnly,
        syncExistingMenuOnly,
        itemId: menuItemId,
        matchedMenuName: matches[0].name,
        syncedCategory: category || null,
        syncedCategoryId,
        categoryDisplayOrder,
        prunedCategoryCount,
        fullCategorySync: fullCategorySyncResult,
        sourcePlatform,
        optionGroupCount,
        optionItemCount,
        menuPreserved: true,
        existingOptionsReplaced: true,
        optionPricesPreserved: false,
        optionPricesImported: true,
      });
    }

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