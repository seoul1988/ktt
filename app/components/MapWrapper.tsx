"use client";

import dynamic from "next/dynamic";

const BusinessMap = dynamic(() => import("./BusinessMap"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F3EC] text-sm font-bold text-[#172033]">
      Loading map...
    </div>
  ),
});

type MapCategory = {
  id?: number;
  name: string;
  emoji: string | null;
};

type MapWrapperProps = {
  spots: any[];
  categories?: MapCategory[];
  showAllOnLoad?: boolean;
  activeNav?: "map" | "deals" | "events";
  communityMode?: boolean;
  role?: string | null;
  initialCategory?: string;
  initialSearch?: string;
};

/**
 * 한글, 영문, 숫자 검색 비교용 문자열 정리
 *
 * - 한글 조합 문자를 NFC 형식으로 통일
 * - 영문은 소문자로 변환
 * - 앞뒤 공백 제거
 * - 문자열 안의 모든 공백 제거
 */
function normalizeSearchText(value: unknown) {
  return String(value ?? "")
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

/**
 * tags 값이 여러 형식으로 들어와도 문자열로 변환합니다.
 *
 * - ["한식", "갈비"]
 * - "한식, 갈비"
 * - '["한식","갈비"]'
 * - null
 */
function getTagsText(tags: unknown) {
  if (Array.isArray(tags)) {
    return tags
      .map((tag) => String(tag ?? ""))
      .filter(Boolean)
      .join(" ");
  }

  if (typeof tags === "string") {
    const trimmedTags = tags.trim();

    if (!trimmedTags) {
      return "";
    }

    try {
      const parsedTags = JSON.parse(trimmedTags);

      if (Array.isArray(parsedTags)) {
        return parsedTags
          .map((tag) => String(tag ?? ""))
          .filter(Boolean)
          .join(" ");
      }
    } catch {
      // JSON 문자열이 아니면 일반 문자열로 사용합니다.
    }

    return trimmedTags;
  }

  if (tags && typeof tags === "object") {
    return Object.values(tags)
      .map((tag) => String(tag ?? ""))
      .filter(Boolean)
      .join(" ");
  }

  return "";
}

/**
 * BusinessMap 검색창에서 사용할 통합 검색 문자열입니다.
 */
function createSearchText(spot: any) {
  const searchableValues = [
    spot.business_name,
    spot.name,
    spot.title,

    getTagsText(spot.tags),
    getTagsText(spot.tag),

    spot.category,
    spot.category_name,
    spot.categories,
    spot.matched_categories,
    spot.description,

    spot.address,
    spot.full_address,
    spot.formatted_address,
    spot.location,
    spot.city,
    spot.state,
    spot.zip,
    spot.zip_code,

    spot.phone,
    spot.phone_number,
    spot.website,

    spot.deal_title,
    spot.deal_description,

    spot.event_title,
    spot.event_description,
  ];

  return normalizeSearchText(
    searchableValues
      .flatMap((value) => {
        if (Array.isArray(value)) {
          return value;
        }

        return [value];
      })
      .filter(
        (value) =>
          value !== null &&
          value !== undefined &&
          String(value).trim() !== "",
      )
      .join(" "),
  );
}

export default function MapWrapper({
  spots,
  categories = [],
  showAllOnLoad = false,
  activeNav = "map",
  communityMode = false,
  role = null,
  initialCategory = "",
  initialSearch = "",
}: MapWrapperProps) {
  /*
   * 모든 업체에 통합 검색 문자열을 추가합니다.
   */
  const searchableSpots = spots.map((spot) => ({
    ...spot,
    search_text: createSearchText(spot),
  }));

  /*
   * show_marker=false인 업체는 지도 마커에서 제외합니다.
   * 비즈니스 ID 199는 KIOTI 전용 로고를 사용합니다.
   */
  const markerSpots = searchableSpots
    .filter((spot) => spot.show_marker !== false)
    .map((spot) => ({
      ...spot,
      alwaysShowKiotiLogo: String(spot.id) === "199",
    }));

  /*
   * URL 검색어나 카테고리가 바뀌면
   * BusinessMap을 새로 초기화합니다.
   */
  const mapKey = [
    activeNav,
    communityMode ? "community" : "business",
    normalizeSearchText(initialCategory),
    normalizeSearchText(initialSearch),

    searchableSpots
      .map(
        (spot) =>
          spot.map_key ||
          `${spot.type || "spot"}-${spot.id}`,
      )
      .join("-"),
  ].join("|");

  return (
    <div key={mapKey} className="min-h-screen">
      <BusinessMap
        spots={searchableSpots}
        markerSpots={markerSpots}
        categories={categories}
        showAllOnLoad={showAllOnLoad}
        activeNav={activeNav}
        communityMode={communityMode}
        role={role}
        initialCategory={initialCategory}
        initialSearch={initialSearch}
      />
    </div>
  );
}