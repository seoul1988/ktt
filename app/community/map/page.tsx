// app/community/map/page.tsx

import { supabase } from "../../../lib/supabase";
import CommunityBottomNav from "../../components/CommunityBottomNav";
import MapWrapper from "../../components/MapWrapper";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CommunityCategory = {
  id: number;
  name: string;
  emoji: string | null;
  hidden?: boolean | null;
};

type CategoryLoadResult = {
  categoryList: CommunityCategory[];
  allowedCategoryIds: Set<number>;
  allowedCategoryNames: Set<string>;
  categoryEmojiMap: Map<string, string | null>;
  error: any | null;
};

type CommunityMapPageProps = {
  searchParams: Promise<{
    category?: string | string[];
    search?: string | string[];
  }>;
};

function normalizeCategory(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9가-힣]/g, "");
}

function getSearchParamValue(
  value: string | string[] | undefined,
) {
  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return value || "";
}

function splitCategories(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return item.trim();
        }

        if (item && typeof item === "object") {
          const objectItem = item as Record<string, unknown>;

          return String(
            objectItem.name ??
              objectItem.category ??
              objectItem.category_name ??
              "",
          ).trim();
        }

        return String(item ?? "").trim();
      })
      .filter(Boolean);
  }

  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * URL에서 받은 category 값을 실제 카테고리 이름으로 변환합니다.
 *
 * 예:
 * hair → Hair
 * hair salon → Hair Salon
 * beauty-salon → Beauty Salon
 */
function resolveInitialCategory(
  requestedCategory: string,
  categoryList: CommunityCategory[],
) {
  const normalizedRequested =
    normalizeCategory(requestedCategory);

  if (!normalizedRequested) {
    return "";
  }

  /*
   * 먼저 정확히 일치하는 카테고리를 찾습니다.
   */
  const exactMatch = categoryList.find(
    (category) =>
      normalizeCategory(category.name) ===
      normalizedRequested,
  );

  if (exactMatch) {
    return exactMatch.name;
  }

  /*
   * hair 입력 시 Hair Salon처럼
   * 해당 단어를 포함하는 카테고리를 찾습니다.
   */
  const startsWithMatch = categoryList.find(
    (category) =>
      normalizeCategory(category.name).startsWith(
        normalizedRequested,
      ),
  );

  if (startsWithMatch) {
    return startsWithMatch.name;
  }

  const includesMatch = categoryList.find(
    (category) =>
      normalizeCategory(category.name).includes(
        normalizedRequested,
      ),
  );

  if (includesMatch) {
    return includesMatch.name;
  }

  return "";
}

/**
 * Community Map에 표시하도록 체크된 카테고리만 가져옵니다.
 * hidden=true인 카테고리는 표시하지 않습니다.
 */
async function getCommunityCategories(): Promise<CategoryLoadResult> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, emoji, hidden")
    .eq("show_on_community_map", true)
    .order("name", {
      ascending: true,
    });

  if (error) {
    console.error(
      "Community map categories load error:",
      error,
    );

    return {
      categoryList: [],
      allowedCategoryIds: new Set<number>(),
      allowedCategoryNames: new Set<string>(),
      categoryEmojiMap: new Map<
        string,
        string | null
      >(),
      error,
    };
  }

  /*
   * hidden=true인 카테고리와
   * 이름이 없는 카테고리는 제외합니다.
   */
  const categoryList = (
    (data || []) as CommunityCategory[]
  ).filter(
    (category) =>
      category.hidden !== true &&
      Boolean(category.name?.trim()),
  );

  return {
    categoryList,

    allowedCategoryIds: new Set(
      categoryList.map((category) =>
        Number(category.id),
      ),
    ),

    allowedCategoryNames: new Set(
      categoryList
        .map((category) =>
          normalizeCategory(category.name),
        )
        .filter(Boolean),
    ),

    categoryEmojiMap: new Map(
      categoryList.map((category) => [
        normalizeCategory(category.name),
        category.emoji,
      ]),
    ),

    error: null,
  };
}

/**
 * 업체가 Community Map 허용 카테고리에 속하는지 확인합니다.
 *
 * 지원 필드:
 * category_id
 * business_category_id
 * category
 * category_name
 * categories
 */
function getMatchedCommunityCategories(
  business: any,
  allowedCategoryIds: Set<number>,
  allowedCategoryNames: Set<string>,
) {
  if (!business) {
    return {
      isAllowed: false,
      matchedNames: [] as string[],
    };
  }

  const rawCategoryId =
    business.category_id ??
    business.business_category_id ??
    null;

  const hasCategoryId =
    rawCategoryId !== null &&
    rawCategoryId !== undefined &&
    rawCategoryId !== "";

  /*
   * ID가 있지만 허용 카테고리가 아니면 제외합니다.
   */
  if (
    hasCategoryId &&
    !allowedCategoryIds.has(Number(rawCategoryId))
  ) {
    return {
      isAllowed: false,
      matchedNames: [] as string[],
    };
  }

  const categoryValues = [
    ...splitCategories(business.category),
    ...splitCategories(business.category_name),
    ...splitCategories(business.categories),
  ];

  const uniqueCategoryNames = Array.from(
    new Set(
      categoryValues
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

  const matchedNames =
    uniqueCategoryNames.filter((categoryName) =>
      allowedCategoryNames.has(
        normalizeCategory(categoryName),
      ),
    );

  /*
   * 허용된 category_id가 있으면
   * 문자열 카테고리가 없어도 표시합니다.
   */
  if (
    hasCategoryId &&
    allowedCategoryIds.has(Number(rawCategoryId))
  ) {
    return {
      isAllowed: true,
      matchedNames,
    };
  }

  return {
    isAllowed: matchedNames.length > 0,
    matchedNames,
  };
}

/**
 * Marketplace 아이템의 카테고리가
 * Community Map 허용 카테고리인지 확인합니다.
 */
function getMatchedMarketplaceCategories(
  item: any,
  allowedCategoryNames: Set<string>,
) {
  const rawCategories = splitCategories(
    item?.category ??
      item?.categories ??
      "Marketplace",
  );

  return rawCategories.filter((categoryName) =>
    allowedCategoryNames.has(
      normalizeCategory(categoryName),
    ),
  );
}

export default async function CommunityMapPage({
  searchParams,
}: CommunityMapPageProps) {
  const params = await searchParams;

  const requestedCategory = decodeURIComponent(
    getSearchParamValue(params.category),
  ).trim();

  const requestedSearch = decodeURIComponent(
    getSearchParamValue(params.search),
  ).trim();

  const {
    categoryList,
    allowedCategoryIds,
    allowedCategoryNames,
    categoryEmojiMap,
    error: categoryError,
  } = await getCommunityCategories();

  if (categoryError) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] p-5 text-[#172033]">
        <p className="font-bold text-red-600">
          커뮤니티 카테고리 불러오기 실패:{" "}
          {categoryError.message}
        </p>
      </main>
    );
  }

  /*
   * URL의 category=hair를
   * 실제 DB 카테고리 이름으로 변환합니다.
   */
  const initialCategory =
    resolveInitialCategory(
      requestedCategory,
      categoryList,
    );

  /*
   * BUSINESS 불러오기
   */
  const {
    data: businesses,
    error: businessError,
  } = await supabase
    .from("businesses")
    .select("*")
    .eq("hidden", false)
    .not("lat", "is", null)
    .not("lng", "is", null)
    .order("id", {
      ascending: true,
    });

  if (businessError) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] p-5 text-[#172033]">
        <p className="font-bold text-red-600">
          커뮤니티 지도 불러오기 실패:{" "}
          {businessError.message}
        </p>
      </main>
    );
  }

  /*
   * MARKETPLACE 불러오기
   */
  const {
    data: marketplaceItems,
    error: marketplaceError,
  } = await supabase
    .from("marketplace_items")
    .select("*")
    .eq("sold", false)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .order("created_at", {
      ascending: false,
    });

  if (marketplaceError) {
    console.error(
      "Community marketplace load error:",
      marketplaceError,
    );
  }

  const businessSpots =
    businesses
      ?.map((business: any) => {
        const {
          isAllowed,
          matchedNames,
        } =
          getMatchedCommunityCategories(
            business,
            allowedCategoryIds,
            allowedCategoryNames,
          );

        if (!isAllowed) {
          return null;
        }

        const businessId = Number(business.id);
        const lat = Number(business.lat);
        const lng = Number(business.lng);

        if (
          !Number.isFinite(businessId) ||
          !Number.isFinite(lat) ||
          !Number.isFinite(lng)
        ) {
          return null;
        }

        const rawCategories = Array.from(
          new Set([
            ...splitCategories(
              business.category,
            ),
            ...splitCategories(
              business.category_name,
            ),
            ...splitCategories(
              business.categories,
            ),
          ]),
        );

        const visibleCategories =
          rawCategories.filter((categoryName) =>
            allowedCategoryNames.has(
              normalizeCategory(categoryName),
            ),
          );

        const firstCategory =
          matchedNames[0] ||
          visibleCategories[0] ||
          "Business";

        const normalizedFirstCategory =
          normalizeCategory(firstCategory);

        return {
          ...business,

          id: businessId,
          business_id: businessId,
          original_business_id: businessId,
          original_id: businessId,

          name:
            business.name ||
            business.business_name ||
            "No business name",

          category: firstCategory,
          categories:
            visibleCategories.join(", "),
          matched_categories: matchedNames,

          emoji:
            categoryEmojiMap.get(
              normalizedFirstCategory,
            ) ||
            business.emoji ||
            "📍",

          image_url:
            business.image_url ||
            business.logo_url ||
            null,

          lat,
          lng,

          show_marker: true,

          type: "business",
          source_type: "community-business",

          community_visible: true,

          map_key: `community-business-${businessId}`,
        };
      })
      .filter(Boolean) || [];

  /*
   * 중복 비즈니스 제거
   */
  const uniqueBusinessSpots =
    Array.from(
      new Map(
        businessSpots.map((spot: any) => [
          spot.map_key,
          spot,
        ]),
      ).values(),
    );

  /*
   * Community Map 허용 카테고리의 Marketplace만 포함
   */
  const marketplaceSpots =
    marketplaceItems
      ?.map((item: any) => {
        const matchedCategories =
          getMatchedMarketplaceCategories(
            item,
            allowedCategoryNames,
          );

        if (matchedCategories.length === 0) {
          return null;
        }

        const marketplaceId = Number(item.id);
        const lat = Number(item.latitude);
        const lng = Number(item.longitude);

        if (
          !Number.isFinite(marketplaceId) ||
          !Number.isFinite(lat) ||
          !Number.isFinite(lng)
        ) {
          return null;
        }

        const firstCategory =
          matchedCategories[0];

        const normalizedFirstCategory =
          normalizeCategory(firstCategory);

        return {
          ...item,

          id: marketplaceId,
          marketplace_id: marketplaceId,
          original_id: marketplaceId,

          business_id: `marketplace-${marketplaceId}`,
          original_business_id: `marketplace-${marketplaceId}`,

          name:
            item.title ||
            "Marketplace Item",

          category: firstCategory,
          categories:
            matchedCategories.join(", "),
          matched_categories:
            matchedCategories,

          emoji:
            categoryEmojiMap.get(
              normalizedFirstCategory,
            ) || "🛍️",

          image_url:
            item.image_urls?.[0] ||
            item.image_url ||
            null,

          image_urls:
            item.image_urls || null,

          lat,
          lng,

          show_marker: true,

          price: item.price,

          type: "marketplace",
          source_type: "marketplace",

          community_visible: true,

          map_key: `community-marketplace-${marketplaceId}`,
        };
      })
      .filter(Boolean) || [];

  const spots = [
    ...uniqueBusinessSpots,
    ...marketplaceSpots,
  ];

  return (
    <main className="relative min-h-screen bg-[#F8F3EC]">
      <MapWrapper
        spots={spots}
        categories={categoryList}
        showAllOnLoad={false}
        activeNav="map"
        communityMode={true}
        initialCategory={initialCategory}
        initialSearch={requestedSearch}
      />

      <CommunityBottomNav activeNav="map" />
    </main>
  );
}