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
 * tags 값이 아래 형식 중 어느 것이어도 문자열로 변환합니다.
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

    if (!trimmedTags) return "";

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
 *
 * 업체 제목과 tags를 우선 포함하며,
 * 기존 검색 기능과 호환되도록 카테고리, 주소, 전화번호 등도 포함합니다.
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
    spot.description,

    spot.address,
    spot.city,
    spot.state,
    spot.zip,
    spot.zip_code,

    spot.phone,
    spot.website,

    spot.deal_title,
    spot.deal_description,

    spot.event_title,
    spot.event_description,
  ];

  return normalizeSearchText(
    searchableValues
      .filter(
        (value) =>
          value !== null &&
          value !== undefined &&
          String(value).trim() !== ""
      )
      .join(" ")
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
}: MapWrapperProps) {
  /*
   * 모든 업체에 통합 검색 문자열을 추가합니다.
   *
   * BusinessMap 검색창에서는 다음 방식으로 사용할 수 있습니다.
   *
   * normalizeSearchText(검색어)
   * spot.search_text.includes(normalizeSearchText(검색어))
   *
   * 따라서 "서", "한", "갈"처럼 한글 한 글자만 입력해도
   * 업체 제목 또는 tags에 포함되어 있으면 검색됩니다.
   */
  const searchableSpots = spots.map((spot) => ({
    ...spot,
    search_text: createSearchText(spot),
  }));

  /*
   * 비즈니스 ID 199는 전용 KIOTI 로고를 사용합니다.
   * show_marker가 false인 경우에는 다른 비즈니스와 마찬가지로 제외됩니다.
   */
  const markerSpots = searchableSpots
    .filter((spot) => spot.show_marker !== false)
    .map((spot) => ({
      ...spot,

      // id가 문자열 "199"로 들어오는 경우까지 처리
      alwaysShowKiotiLogo: String(spot.id) === "199",
    }));

  const mapKey = `${activeNav}-${
    communityMode ? "community" : "business"
  }-${searchableSpots
    .map(
      (spot) =>
        spot.map_key ||
        `${spot.type || "spot"}-${spot.id}`
    )
    .join("-")}-${initialCategory}`;

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
      />
    </div>
  );
}