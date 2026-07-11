// app/map/page.tsx

import { supabase } from "../../lib/supabase";
import MapWrapper from "../components/MapWrapper";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Promise<{
  view?: string;
  category?: string;
}>;

type MainMapCategory = {
  id: number;
  name: string;
};

type MainMapCategoryResult = {
  categoryIds: Set<number>;
  categoryNames: Set<string>;
  error: any | null;
};

/**
 * 비교용 문자열 정리
 */
function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/**
 * Main App Map에 표시 가능한 카테고리만 불러옵니다.
 *
 * Main이 false인 카테고리는 모두 제외됩니다.
 *
 * B2B 전용:
 * show_on_main_map = false
 * show_on_b2b = true
 *
 * Hidden:
 * show_on_main_map = false
 * show_on_community_map = false
 * show_on_b2b = false
 */
async function getMainMapCategories(): Promise<MainMapCategoryResult> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .eq("show_on_main_map", true);

  if (error) {
    console.error("Main map category load error:", error);

    return {
      categoryIds: new Set<number>(),
      categoryNames: new Set<string>(),
      error,
    };
  }

  const categories = (data || []) as MainMapCategory[];

  return {
    categoryIds: new Set(
      categories.map((item) => Number(item.id))
    ),

    categoryNames: new Set(
      categories
        .map((item) => normalizeText(item.name))
        .filter(Boolean)
    ),

    error: null,
  };
}

/**
 * 업체의 카테고리가 Main App Map 허용 카테고리인지 확인합니다.
 *
 * 지원하는 businesses 필드:
 * category_id
 * business_category_id
 * category
 * category_name
 *
 * 카테고리가 배열인 경우도 일부 지원합니다.
 */
function isMainMapBusiness(
  business: any,
  categoryIds: Set<number>,
  categoryNames: Set<string>
) {
  if (!business) return false;

  /*
   * 1. category_id 확인
   */
  const rawCategoryId =
    business.category_id ??
    business.business_category_id ??
    null;

  if (
    rawCategoryId !== null &&
    rawCategoryId !== undefined &&
    rawCategoryId !== ""
  ) {
    return categoryIds.has(Number(rawCategoryId));
  }

  /*
   * 2. categories가 객체 또는 배열로 join되어 있는 경우
   */
  if (business.categories) {
    const joinedCategories = Array.isArray(business.categories)
      ? business.categories
      : [business.categories];

    const hasMainCategory = joinedCategories.some(
      (joinedCategory: any) => {
        if (!joinedCategory) return false;

        if (
          joinedCategory.id !== null &&
          joinedCategory.id !== undefined
        ) {
          return categoryIds.has(Number(joinedCategory.id));
        }

        if (joinedCategory.name) {
          return categoryNames.has(
            normalizeText(joinedCategory.name)
          );
        }

        return false;
      }
    );

    if (hasMainCategory) return true;
  }

  /*
   * 3. category 또는 category_name 문자열 확인
   */
  const rawCategoryName =
    business.category ??
    business.category_name ??
    null;

  if (Array.isArray(rawCategoryName)) {
    return rawCategoryName.some((item) =>
      categoryNames.has(normalizeText(item))
    );
  }

  if (rawCategoryName) {
    /*
     * 단일 카테고리
     */
    const normalizedCategory =
      normalizeText(rawCategoryName);

    if (categoryNames.has(normalizedCategory)) {
      return true;
    }

    /*
     * 쉼표로 여러 카테고리가 저장된 경우
     */
    const categoryParts = String(rawCategoryName)
      .split(",")
      .map((item) => normalizeText(item))
      .filter(Boolean);

    return categoryParts.some((item) =>
      categoryNames.has(item)
    );
  }

  /*
   * 카테고리가 없는 업체는 제외합니다.
   * 잘못 설정된 B2B 또는 Hidden 업체가 노출되는 것을 방지합니다.
   */
  return false;
}

/**
 * MapWrapper로 전달할 일반 업체 형태
 */
function createBusinessSpot(business: any) {
  const businessId = business.id;

  return {
    ...business,

    id: businessId,
    business_id: businessId,
    original_business_id: businessId,

    source_type: "business",
    map_key: `business-${businessId}`,

    has_deal: false,
    has_event: false,
  };
}

export default async function MapPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const view = params?.view || "";
  const requestedCategory = params?.category || "";

  const today = new Date().toISOString().slice(0, 10);

  /*
   * Main App Map 허용 카테고리 로드
   */
  const {
    categoryIds,
    categoryNames,
    error: categoryError,
  } = await getMainMapCategories();

  if (categoryError) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] p-5 text-[#172033]">
        <p className="font-bold text-red-600">
          카테고리 설정 불러오기 실패:{" "}
          {categoryError.message}
        </p>
      </main>
    );
  }

  /*
   * URL로 Hidden 또는 B2B 카테고리를 직접 넣어도
   * 초기 카테고리로 전달하지 않습니다.
   */
  const initialCategory = categoryNames.has(
    normalizeText(requestedCategory)
  )
    ? requestedCategory
    : "";

  /*
   * DEAL MAP
   */
  if (view === "deals") {
    const { data: deals, error } = await supabase
      .from("deals")
      .select(`
        id,
        title,
        description,
        image_url,
        start_date,
        end_date,
        business_id,
        created_at,
        businesses (*)
      `)
      .eq("status", "approved")
      .eq("active", true)
      .or(`end_date.is.null,end_date.gte.${today}`)
      .order("created_at", { ascending: false });

    if (error) {
      return (
        <main className="min-h-screen bg-[#F8F3EC] p-5 text-[#172033]">
          <p className="font-bold text-red-600">
            DEAL 지도 불러오기 실패: {error.message}
          </p>
        </main>
      );
    }

    const spots =
      deals
        ?.map((deal: any) => {
          const business = Array.isArray(deal.businesses)
            ? deal.businesses[0]
            : deal.businesses;

          if (!business) return null;

          /*
           * Main App Map에 허용되지 않은 업체는
           * MapWrapper에 전달하지 않습니다.
           *
           * 따라서 업체명, 태그, 설명으로도 검색되지 않습니다.
           */
          if (
            !isMainMapBusiness(
              business,
              categoryIds,
              categoryNames
            )
          ) {
            return null;
          }

          const businessId = business.id;

          return {
            ...business,

            id: businessId,
            business_id: businessId,
            original_business_id: businessId,

            source_type: "deal",
            map_key: `deal-${deal.id}-business-${businessId}`,

            deal_id: deal.id,
            deal_title: deal.title,
            deal_description: deal.description,
            deal_image_url: deal.image_url,
            deal_start_date: deal.start_date,
            deal_end_date: deal.end_date,

            has_deal: true,
            has_event: false,
          };
        })
        .filter(Boolean) || [];

    return (
      <MapWrapper
        spots={spots}
        showAllOnLoad={true}
        activeNav="deals"
        initialCategory={initialCategory}
      />
    );
  }

  /*
   * EVENT MAP
   */
  if (view === "events") {
    const { data: events, error } = await supabase
      .from("business_events")
      .select(`
        id,
        title,
        description,
        event_date,
        image_url,
        business_id,
        businesses (*)
      `)
      .eq("status", "approved")
      .eq("active", true)
      .or(`event_date.is.null,event_date.gte.${today}`)
      .not("business_id", "is", null)
      .order("event_date", { ascending: true });

    if (error) {
      return (
        <main className="min-h-screen bg-[#F8F3EC] p-5 text-[#172033]">
          <p className="font-bold text-red-600">
            EVENT 지도 불러오기 실패: {error.message}
          </p>
        </main>
      );
    }

    const spots =
      events
        ?.map((event: any) => {
          const business = Array.isArray(
            event.businesses
          )
            ? event.businesses[0]
            : event.businesses;

          if (!business) return null;

          /*
           * B2B 전용 및 Hidden 업체는
           * 이벤트가 있어도 Main 지도에서 완전히 제외합니다.
           */
          if (
            !isMainMapBusiness(
              business,
              categoryIds,
              categoryNames
            )
          ) {
            return null;
          }

          const businessId = business.id;

          return {
            ...business,

            id: businessId,
            business_id: businessId,
            original_business_id: businessId,

            source_type: "event",
            map_key: `event-${event.id}-business-${businessId}`,

            event_id: event.id,
            event_title: event.title,
            event_description: event.description,
            event_image_url: event.image_url,
            event_date: event.event_date,

            has_event: true,
            has_deal: false,
          };
        })
        .filter(Boolean) || [];

    return (
      <MapWrapper
        spots={spots}
        showAllOnLoad={true}
        activeNav="events"
        initialCategory={initialCategory}
      />
    );
  }

  /*
   * MAIN BUSINESS MAP
   */
const { data: businesses, error } = await supabase
  .from("businesses")
  .select("*")
  .or("hidden.eq.false,hidden.is.null")
  .order("id", { ascending: true });

  if (error) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] p-5 text-[#172033]">
        <p className="font-bold text-red-600">
          지도 불러오기 실패: {error.message}
        </p>
      </main>
    );
  }

  /*
   * Main App Map 허용 업체만 남깁니다.
   *
   * 이 필터를 통과하지 못한 업체는 spots 배열에 존재하지 않으므로
   * MapWrapper 검색창에서 아래 항목으로 검색해도 나오지 않습니다.
   *
   * business_name
   * name
   * tags
   * description
   * category
   * address
   * city
   * phone
   * website
   */
  const visibleBusinesses =
    businesses?.filter((business: any) =>
      isMainMapBusiness(
        business,
        categoryIds,
        categoryNames
      )
    ) || [];

  const spots = visibleBusinesses.map(
    (business: any) => createBusinessSpot(business)
  );

  return (
    <MapWrapper
      spots={spots}
      showAllOnLoad={false}
      activeNav="map"
      initialCategory={initialCategory}
    />
  );
}