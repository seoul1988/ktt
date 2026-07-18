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
};

type CategoryLoadResult = {
  categoryList: CommunityCategory[];
  allowedCategoryIds: Set<number>;
  allowedCategoryNames: Set<string>;
  categoryEmojiMap: Map<string, string | null>;
  error: any | null;
};

function normalizeCategory(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function splitCategories(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return item.trim();
        }

        if (item && typeof item === "object") {
          return String(
            item.name ?? item.category ?? item.category_name ?? "",
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
 * Community Map에 표시하도록 체크된 카테고리만 가져옵니다.
 */
async function getCommunityCategories(): Promise<CategoryLoadResult> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, emoji")
    .eq("show_on_community_map", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("Community map categories load error:", error);

    return {
      categoryList: [],
      allowedCategoryIds: new Set<number>(),
      allowedCategoryNames: new Set<string>(),
      categoryEmojiMap: new Map<string, string | null>(),
      error,
    };
  }

 const categoryList = ((data || []) as CommunityCategory[]).filter(
  (category) => normalizeCategory(category.name) !== "beauty supply",
);

  return {
    categoryList,

    allowedCategoryIds: new Set(
      categoryList.map((category) => Number(category.id)),
    ),

    allowedCategoryNames: new Set(
      categoryList
        .map((category) => normalizeCategory(category.name))
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

  /*
   * category_id 또는 business_category_id가 있는 경우
   */
  const rawCategoryId =
    business.category_id ?? business.business_category_id ?? null;

  if (
    rawCategoryId !== null &&
    rawCategoryId !== undefined &&
    rawCategoryId !== ""
  ) {
    const isAllowed = allowedCategoryIds.has(Number(rawCategoryId));

    if (!isAllowed) {
      return {
        isAllowed: false,
        matchedNames: [] as string[],
      };
    }
  }

  /*
   * 카테고리 이름들을 수집합니다.
   */
  const categoryValues = [
    ...splitCategories(business.category),
    ...splitCategories(business.category_name),
    ...splitCategories(business.categories),
  ];

  const uniqueCategoryNames = Array.from(
    new Set(categoryValues.map((item) => item.trim()).filter(Boolean)),
  );

  const matchedNames = uniqueCategoryNames.filter((categoryName) =>
    allowedCategoryNames.has(normalizeCategory(categoryName)),
  );

  /*
   * ID가 있고 Community 허용 ID에 속한다면,
   * 카테고리 문자열이 비어 있어도 허용합니다.
   */
  if (
    rawCategoryId !== null &&
    rawCategoryId !== undefined &&
    rawCategoryId !== "" &&
    allowedCategoryIds.has(Number(rawCategoryId))
  ) {
    return {
      isAllowed: true,
      matchedNames,
    };
  }

  /*
   * 카테고리 이름 중 하나라도 Community 허용이면 표시합니다.
   */
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
    item?.category ?? item?.categories ?? "Marketplace",
  );

  return rawCategories.filter((categoryName) =>
    allowedCategoryNames.has(normalizeCategory(categoryName)),
  );
}

export default async function CommunityMapPage() {
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
          커뮤니티 카테고리 불러오기 실패: {categoryError.message}
        </p>
      </main>
    );
  }

  /*
   * BUSINESS 불러오기
   */
  const { data: businesses, error: businessError } = await supabase
    .from("businesses")
    .select("*")
    .eq("hidden", false)
    .not("lat", "is", null)
    .not("lng", "is", null)
    .order("id", { ascending: true });

  if (businessError) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] p-5 text-[#172033]">
        <p className="font-bold text-red-600">
          커뮤니티 지도 불러오기 실패: {businessError.message}
        </p>
      </main>
    );
  }

  /*
   * MARKETPLACE 불러오기
   */
  const { data: marketplaceItems, error: marketplaceError } = await supabase
    .from("marketplace_items")
    .select("*")
    .eq("sold", false)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .order("created_at", { ascending: false });

  if (marketplaceError) {
    console.error("Community marketplace load error:", marketplaceError);
  }

  /*
   * Community Map 허용 비즈니스만 spots에 포함합니다.
   *
   * Community Map이 체크되지 않은 비즈니스는
   * 여기서 null 처리되어 MapWrapper로 전달되지 않습니다.
   *
   * 따라서 이름, 태그, 설명, 주소 등으로도 검색되지 않습니다.
   */
  const businessSpots =
    businesses
      ?.map((business: any) => {
        const { isAllowed, matchedNames } = getMatchedCommunityCategories(
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
            ...splitCategories(business.category),
            ...splitCategories(business.category_name),
            ...splitCategories(business.categories),
          ]),
        );

        const firstCategory = matchedNames[0] || rawCategories[0] || "Business";

        const normalizedFirstCategory = normalizeCategory(firstCategory);

        return {
          ...business,

          id: businessId,
          business_id: businessId,
          original_business_id: businessId,
          original_id: businessId,

          name: business.name || business.business_name || "No business name",

          category: firstCategory,
          categories: rawCategories.join(", "),
          matched_categories: matchedNames,

          emoji:
            categoryEmojiMap.get(normalizedFirstCategory) ||
            business.emoji ||
            "📍",

          image_url: business.image_url || business.logo_url || null,

          lat,
          lng,

          // 유효한 좌표가 있는 항목은 거리 제한 없이 지도 마커를 표시합니다.
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
  const uniqueBusinessSpots = Array.from(
    new Map(businessSpots.map((spot: any) => [spot.map_key, spot])).values(),
  );

  /*
   * Community Map 허용 카테고리의 Marketplace만 포함
   */
  const marketplaceSpots =
    marketplaceItems
      ?.map((item: any) => {
        const matchedCategories = getMatchedMarketplaceCategories(
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

        const firstCategory = matchedCategories[0];

        const normalizedFirstCategory = normalizeCategory(firstCategory);

        return {
          ...item,

          id: marketplaceId,
          marketplace_id: marketplaceId,
          original_id: marketplaceId,

          business_id: `marketplace-${marketplaceId}`,
          original_business_id: `marketplace-${marketplaceId}`,

          name: item.title || "Marketplace Item",

          category: firstCategory,
          categories: matchedCategories.join(", "),
          matched_categories: matchedCategories,

          emoji: categoryEmojiMap.get(normalizedFirstCategory) || "🛍️",

          image_url: item.image_urls?.[0] || item.image_url || null,

          image_urls: item.image_urls || null,

          lat,
          lng,

          // 유효한 좌표가 있는 항목은 거리 제한 없이 지도 마커를 표시합니다.
          show_marker: true,

          price: item.price,

          type: "marketplace",
          source_type: "marketplace",

          community_visible: true,

          map_key: `community-marketplace-${marketplaceId}`,
        };
      })
      .filter(Boolean) || [];

  const spots = [...uniqueBusinessSpots, ...marketplaceSpots];

  return (
    <main className="relative min-h-screen bg-[#F8F3EC]">
      <MapWrapper
        spots={spots}
        categories={categoryList}
        showAllOnLoad={false}
        activeNav="map"
        communityMode={true}
      />

      <CommunityBottomNav activeNav="map" />
    </main>
  );
}