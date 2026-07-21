"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import CommunityBottomNav from "../../components/CommunityBottomNav";

type Category = {
  id: number | string;
  name: string;
  show_on_community_map?: boolean | null;
};

type Business = {
  id: number | string;
  name: string;
  category?: string | null;
  category_name?: string | null;
  categories?: unknown;
  tag?: unknown;
  city?: string | null;
  address?: string | null;
  image_url?: string | null;
  rating?: number | string | null;
  review_count?: number | null;
};

type CommunitySearchDirectoryProps = {
  categories: Category[];
  businesses: Business[];
};

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/**
 * 서버(Node.js)와 브라우저에서 동일한 정렬 결과를 만들기 위한 비교 함수입니다.
 * localeCompare()는 실행 환경의 ICU/로케일 차이로 순서가 달라질 수 있습니다.
 */
function compareBusinessNames(a: Business, b: Business) {
  const aName = normalize(a.name);
  const bName = normalize(b.name);

  if (aName < bName) return -1;
  if (aName > bName) return 1;

  const aId = String(a.id);
  const bId = String(b.id);

  if (aId < bId) return -1;
  if (aId > bId) return 1;

  return 0;
}

function splitCategories(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return item.trim();
        }

        if (item && typeof item === "object") {
          const categoryObject = item as {
            name?: unknown;
            category?: unknown;
            category_name?: unknown;
          };

          return String(
            categoryObject.name ??
              categoryObject.category ??
              categoryObject.category_name ??
              "",
          ).trim();
        }

        return "";
      })
      .filter(Boolean);
  }

  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getBusinessCategoryNames(business: Business): string[] {
  return [
    ...splitCategories(business.category),
    ...splitCategories(business.category_name),
    ...splitCategories(business.categories),
    ...splitCategories(business.tag),
  ];
}

function categoryNamesMatch(firstValue: string, secondValue: string) {
  const first = normalize(firstValue);
  const second = normalize(secondValue);

  if (!first || !second) {
    return false;
  }

  /*
   * 기본적으로 정확히 같은 카테고리 이름을 우선합니다.
   */
  if (first === second) {
    return true;
  }

  /*
   * Sushi, BBQ, Noodle처럼 실제 비즈니스 데이터에서
   * "Sushi Restaurant", "Japanese Sushi", "Korean BBQ" 등으로
   * 저장되는 대표 카테고리는 키워드가 양쪽에 모두 포함되면
   * 같은 카테고리로 인정합니다.
   *
   * Beauty와 Beauty Supply처럼 서로 다른 카테고리가
   * 무조건 합쳐지는 문제는 방지합니다.
   */
  const keywordGroups = [
    ["sushi", "스시", "초밥"],
    ["bbq", "barbecue", "바베큐", "바비큐"],
    ["noodle", "noodles", "국수", "라면", "면요리"],
    ["restaurant", "restaurants", "food", "dining", "식당", "레스토랑", "한식"],
    ["cafe", "café", "coffee", "카페", "커피"],
    ["bakery", "dessert", "베이커리", "디저트"],
    ["medical", "health", "clinic", "의료", "병원"],
    ["dental", "dentist", "치과"],
    ["auto", "car", "automotive", "자동차"],
    ["real estate", "property", "부동산"],
    ["education", "school", "academy", "교육", "학원"],
  ];

  return keywordGroups.some((group) => {
    const firstHasKeyword = group.some((keyword) =>
      first.includes(keyword),
    );

    const secondHasKeyword = group.some((keyword) =>
      second.includes(keyword),
    );

    return firstHasKeyword && secondHasKeyword;
  });
}

function getBusinessSortRank(business: Business) {
  const categoryText = normalize(getBusinessCategoryNames(business).join(" "));

  if (
    categoryText.includes("bbq") ||
    categoryText.includes("barbecue") ||
    categoryText.includes("바베큐") ||
    categoryText.includes("바비큐") ||
    categoryText.includes("고기")
  ) {
    return 2;
  }

  if (
    categoryText.includes("sushi") ||
    categoryText.includes("스시") ||
    categoryText.includes("초밥")
  ) {
    return 3;
  }

  if (
    categoryText.includes("noodle") ||
    categoryText.includes("국수") ||
    categoryText.includes("라면") ||
    categoryText.includes("면요리")
  ) {
    return 4;
  }

  if (
    categoryText.includes("restaurant") ||
    categoryText.includes("restaurants") ||
    categoryText.includes("food") ||
    categoryText.includes("dining") ||
    categoryText.includes("식당") ||
    categoryText.includes("레스토랑") ||
    categoryText.includes("한식")
  ) {
    return 1;
  }

  if (
    categoryText.includes("cafe") ||
    categoryText.includes("café") ||
    categoryText.includes("coffee") ||
    categoryText.includes("dessert") ||
    categoryText.includes("bakery") ||
    categoryText.includes("카페") ||
    categoryText.includes("커피") ||
    categoryText.includes("디저트") ||
    categoryText.includes("베이커리")
  ) {
    return 5;
  }

  if (
    categoryText.includes("beauty") ||
    categoryText.includes("hair") ||
    categoryText.includes("salon") ||
    categoryText.includes("spa") ||
    categoryText.includes("nail") ||
    categoryText.includes("뷰티") ||
    categoryText.includes("미용") ||
    categoryText.includes("헤어") ||
    categoryText.includes("네일")
  ) {
    return 6;
  }

  return 100;
}

function getCategorySortRank(categoryName: string) {
  const category = normalize(categoryName);

  if (
    category.includes("restaurant") ||
    category.includes("food") ||
    category.includes("식당") ||
    category.includes("레스토랑") ||
    category.includes("한식")
  ) {
    return 1;
  }

  if (
    category.includes("bbq") ||
    category.includes("barbecue") ||
    category.includes("바베큐") ||
    category.includes("바비큐")
  ) {
    return 2;
  }

  if (
    category.includes("sushi") ||
    category.includes("스시") ||
    category.includes("초밥")
  ) {
    return 3;
  }

  if (
    category.includes("chicken") ||
    category.includes("fried chicken") ||
    category.includes("korean chicken") ||
    category.includes("wing") ||
    category.includes("치킨") ||
    category.includes("닭")
  ) {
    return 2;
  }

  if (
    category.includes("noodle") ||
    category.includes("국수") ||
    category.includes("라면")
  ) {
    return 4;
  }

  if (
    category.includes("bakery") ||
    category.includes("bread") ||
    category.includes("cake") ||
    category.includes("pastry") ||
    category.includes("베이커리") ||
    category.includes("빵")
  ) {
    return 3;
  }

  if (
    category.includes("cafe") ||
    category.includes("coffee") ||
    category.includes("카페") ||
    category.includes("베이커리")
  ) {
    return 5;
  }

  if (
    category.includes("beauty") ||
    category.includes("hair") ||
    category.includes("salon") ||
    category.includes("뷰티") ||
    category.includes("미용")
  ) {
    return 6;
  }

  if (
    category.includes("medical") ||
    category.includes("health") ||
    category.includes("clinic") ||
    category.includes("의료") ||
    category.includes("병원")
  ) {
    return 7;
  }

  if (
    category.includes("dental") ||
    category.includes("dentist") ||
    category.includes("치과")
  ) {
    return 8;
  }

  if (
    category.includes("auto") ||
    category.includes("car") ||
    category.includes("automotive") ||
    category.includes("자동차")
  ) {
    return 9;
  }

  if (
    category.includes("real estate") ||
    category.includes("property") ||
    category.includes("부동산")
  ) {
    return 10;
  }

  if (
    category.includes("education") ||
    category.includes("school") ||
    category.includes("academy") ||
    category.includes("교육") ||
    category.includes("학원")
  ) {
    return 11;
  }

  return 100;
}


type DisplayCategory = Category & {
  groupKey?: string;
};

const DISPLAY_CATEGORY_GROUPS = [
  {
    id: "__comingsoon_group__",
    name: "Coming Soon",
    keywords: [],
  },
  {
    id: "__restaurant_group__",
    name: "Restaurant",
    keywords: [
      "restaurant",
      "restaurants",
      "food",
      "dining",
      "식당",
      "레스토랑",
      "한식",
      "sushi",
      "스시",
      "초밥",
      "bbq",
      "barbecue",
      "바베큐",
      "바비큐",
      "고기",
      "noodle",
      "noodles",
      "국수",
      "라면",
      "면요리",
      "hibachi",
      "ramen",
      "pho",
    ],
  },
  {
    id: "__chicken_group__",
    name: "Chicken",
    keywords: [],
  },
  {
    id: "__bakery_group__",
    name: "Bakery",
    keywords: ["bakery", "베이커리", "dessert", "디저트", "cake", "케이크"],
  },
  {
    id: "__cafe_group__",
    name: "Cafe",
    keywords: ["cafe", "café", "coffee", "카페", "커피", "tea", "티"],
  },
  {
    id: "__beauty_group__",
    name: "헤어/미용",
    keywords: [
      "beauty",
      "hair",
      "salon",
      "spa",
      "nail",
      "barber",
      "뷰티",
      "미용",
      "헤어",
      "네일",
      "이발",
    ],
  },
  {
    id: "__health_group__",
    name: "병원/건강",
    keywords: [
      "medical",
      "health",
      "clinic",
      "hospital",
      "doctor",
      "dental",
      "dentist",
      "pharmacy",
      "의료",
      "병원",
      "건강",
      "의사",
      "치과",
      "약국",
    ],
  },
  {
    id: "__realestate_group__",
    name: "부동산",
    keywords: [
      "real estate",
      "realtor",
      "property",
      "mortgage",
      "부동산",
      "리얼터",
      "융자",
    ],
  },
  {
    id: "__church_group__",
    name: "교회/성당",
    keywords: [
      "church",
      "catholic",
      "chapel",
      "ministry",
      "교회",
      "성당",
      "천주교",
      "예배",
    ],
  },
  {
    id: "__market_group__",
    name: "마켓",
    keywords: [
      "market",
      "grocery",
      "supermarket",
      "mart",
      "food market",
      "마켓",
      "마트",
      "식품",
      "식료품",
    ],
  },
] as const;

function textMatchesGroup(value: unknown, groupId: string) {
  const normalizedValue = normalize(value);
  const group = DISPLAY_CATEGORY_GROUPS.find((item) => item.id === groupId);

  if (!normalizedValue || !group) {
    return false;
  }

  return group.keywords.some((keyword) =>
    normalizedValue.includes(normalize(keyword)),
  );
}

function businessBelongsToGroup(business: Business, groupId: string) {
  const businessCategories = getBusinessCategoryNames(business).map(normalize);

  // 비즈니스에 저장된 category, category_name, categories 또는 tag 중
  // 하나라도 정확히 Coming Soon이면 Coming Soon 그룹에 표시합니다.
  if (groupId === "__comingsoon_group__") {
    return businessCategories.includes("coming soon");
  }

  // 비즈니스에 저장된 category, category_name, categories 또는 tag 중
  // 하나라도 정확히 Chicken이면 Chicken 그룹에 표시합니다.
  if (groupId === "__chicken_group__") {
    return businessCategories.includes("chicken");
  }

  return businessCategories.some((categoryName) =>
    textMatchesGroup(categoryName, groupId),
  );
}

function businessBelongsToAnyDisplayGroup(business: Business) {
  return DISPLAY_CATEGORY_GROUPS.some((group) =>
    businessBelongsToGroup(business, group.id),
  );
}


function CategoryIcon({
  name,
  className = "h-6 w-6",
}: {
  name: string;
  className?: string;
}) {
  const category = normalize(name);

  const commonProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  // Coming Soon
  if (category.includes("coming soon")) {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }

  // Restaurant
  if (category.includes("restaurant")) {
    return (
      <svg {...commonProps}>
        <path d="M6 3v7" />
        <path d="M4 3v4a2 2 0 004 0V3" />
        <path d="M6 10v11" />
        <path d="M15 3v18" />
        <path d="M15 3c3 1 4 3 4 6 0 2-1 3-4 3" />
      </svg>
    );
  }

  // Chicken
  if (
    category.includes("chicken") ||
    category.includes("치킨")
  ) {
    return (
      <svg {...commonProps}>
        <path d="M9.5 5.5c2.2-2.2 5.7-2.2 7.9 0s2.2 5.7 0 7.9c-1.5 1.5-3.6 2-5.5 1.4l-3.7 3.7" />
        <path d="M7.2 17.5l-1.4 1.4" />
        <path d="M5.1 18.8l-1 1" />
        <path d="M11.8 14.8L9.2 12.2" />
      </svg>
    );
  }

  // Bakery
  if (
    category.includes("bakery") ||
    category.includes("베이커리")
  ) {
    return (
      <svg {...commonProps}>
        <path d="M5 12c0-3.9 3.1-7 7-7s7 3.1 7 7v5a2 2 0 01-2 2H7a2 2 0 01-2-2v-5z" />
        <path d="M8.5 9.5c0-1.1.9-2 2-2" />
        <path d="M12 8.5c1.1 0 2 .9 2 2" />
        <path d="M15.5 9.5c0-1 .8-1.8 1.7-1.8" />
        <path d="M8 14h8" />
      </svg>
    );
  }

  // Cafe
  if (
    category.includes("cafe") ||
    category.includes("café") ||
    category.includes("카페")
  ) {
    return (
      <svg {...commonProps}>
        <path d="M5 8h11v6a5 5 0 01-5 5h-1a5 5 0 01-5-5V8z" />
        <path d="M16 10h2a2 2 0 010 4h-2" />
        <path d="M8 4c0 1 1 1.5 1 2.5" />
        <path d="M12 4c0 1 1 1.5 1 2.5" />
      </svg>
    );
  }

  // Hair / Beauty
  if (
    category.includes("헤어") ||
    category.includes("미용") ||
    category.includes("beauty") ||
    category.includes("hair")
  ) {
    return (
      <svg {...commonProps}>
        <circle cx="6" cy="7" r="2.5" />
        <circle cx="6" cy="17" r="2.5" />
        <path d="M8 8.5L20 3" />
        <path d="M8 15.5L20 21" />
        <path d="M9 12h3" />
      </svg>
    );
  }

  // Hospital / Health
  if (
    category.includes("병원") ||
    category.includes("건강") ||
    category.includes("medical") ||
    category.includes("health")
  ) {
    return (
      <svg {...commonProps}>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M12 8v8" />
        <path d="M8 12h8" />
      </svg>
    );
  }

  // Real Estate
  if (
    category.includes("부동산") ||
    category.includes("real estate")
  ) {
    return (
      <svg {...commonProps}>
        <path d="M3 11l9-8 9 8" />
        <path d="M5 10v11h14V10" />
        <path d="M9 21v-7h6v7" />
      </svg>
    );
  }

  // Church / Catholic Church
  if (
    category.includes("교회") ||
    category.includes("성당") ||
    category.includes("church") ||
    category.includes("catholic")
  ) {
    return (
      <svg {...commonProps}>
        <path d="M12 2v6" />
        <path d="M9 5h6" />
        <path d="M5 11l7-5 7 5v10H5V11z" />
        <path d="M9 21v-6h6v6" />
        <path d="M3 21h18" />
      </svg>
    );
  }

  // Market
  if (
    category.includes("마켓") ||
    category.includes("마트") ||
    category.includes("market")
  ) {
    return (
      <svg {...commonProps}>
        <path d="M3 4h2l2 11h10l2-8H6" />
        <circle cx="9" cy="19" r="1.5" />
        <circle cx="17" cy="19" r="1.5" />
        <path d="M8 8h9" />
      </svg>
    );
  }

  // Fallback
  return (
    <svg {...commonProps}>
      <circle cx="12" cy="12" r="8" />
      <path d="M8 12h8" />
      <path d="M12 8v8" />
    </svg>
  );
}

export default function CommunitySearchDirectory({
  categories,
  businesses,
}: CommunitySearchDirectoryProps) {
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showCategories, setShowCategories] = useState(false);
  const [submittedSearchText, setSubmittedSearchText] = useState("");
  const [showLiveMatches, setShowLiveMatches] = useState(false);

  /*
   * 카테고리 버튼은 요청한 8개 그룹만 고정 순서로 표시합니다.
   * 실제 categories 테이블의 세부 카테고리는 각 그룹에 합쳐집니다.
   */
  const sortedCategories = useMemo<DisplayCategory[]>(() => {
    return DISPLAY_CATEGORY_GROUPS.map((group) => ({
      id: group.id,
      name: group.name,
      groupKey: group.id,
      show_on_community_map: true,
    }));
  }, []);

  const selectedCategoryName = useMemo(() => {
    if (selectedCategory === "all") {
      return "";
    }

    return (
      DISPLAY_CATEGORY_GROUPS.find(
        (group) => group.id === selectedCategory,
      )?.name || "Businesses"
    );
  }, [selectedCategory]);

  const liveMatches = useMemo(() => {
    const keyword = normalize(searchText);

    if (!keyword) {
      return [];
    }

    return businesses
      .filter((business) => {
        const businessCategoryNames = getBusinessCategoryNames(business);

        const searchableText = normalize(
          [
            business.name,
            ...businessCategoryNames,
            business.city,
            business.address,
          ].join(" "),
        );

        return searchableText.includes(keyword);
      })
      .sort((a, b) => {
        const aName = normalize(a.name);
        const bName = normalize(b.name);

        const aStartsWith = aName.startsWith(keyword) ? 0 : 1;
        const bStartsWith = bName.startsWith(keyword) ? 0 : 1;

        if (aStartsWith !== bStartsWith) {
          return aStartsWith - bStartsWith;
        }

        const ratingDifference =
          Number(b.rating || 0) - Number(a.rating || 0);

        if (ratingDifference !== 0) {
          return ratingDifference;
        }

        return compareBusinessNames(a, b);
      })
      .slice(0, 8);
  }, [businesses, searchText]);

  const filteredBusinesses = useMemo(() => {
    const keyword = normalize(submittedSearchText);

    return businesses
      .filter((business) => {
        const businessCategoryNames = getBusinessCategoryNames(business);

        const belongsToVisibleCategory =
          businessBelongsToAnyDisplayGroup(business);

        if (!belongsToVisibleCategory) {
          return false;
        }

        const matchesCategory =
          selectedCategory === "all" ||
          businessBelongsToGroup(business, selectedCategory);

        const searchableText = normalize(
          [
            business.name,
            ...businessCategoryNames,
            business.city,
            business.address,
            getBusinessCategoryNames(business).join(" "),
          ].join(" "),
        );

        const matchesSearch =
          !keyword || searchableText.includes(keyword);

        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        const rankDifference =
          getBusinessSortRank(a) - getBusinessSortRank(b);

        if (rankDifference !== 0) {
          return rankDifference;
        }

        const ratingDifference =
          Number(b.rating || 0) - Number(a.rating || 0);

        if (ratingDifference !== 0) {
          return ratingDifference;
        }

        return compareBusinessNames(a, b);
      });
  }, [
    businesses,
    submittedSearchText,
    selectedCategory,
    selectedCategoryName,
  ]);

  function selectCategory(categoryId: string) {
    setSelectedCategory(categoryId);
    setSearchText("");
    setSubmittedSearchText("");
    setShowLiveMatches(false);
    setShowCategories(false);
  }

  function submitSearch() {
    const trimmedSearch = searchText.trim();

    if (!trimmedSearch) {
      setSubmittedSearchText("");
      setShowLiveMatches(false);
      return;
    }

    setSubmittedSearchText(trimmedSearch);
    setSelectedCategory("all");
    setShowCategories(false);
    setShowLiveMatches(false);
  }

  return (
    <main className="min-h-[100dvh] bg-[#F8F3EC] pb-28 text-[#172033]">
      <header className="sticky top-0 z-40 overflow-visible bg-[#F8F3EC] px-4 pb-1 pt-2">
        <div className="mx-auto max-w-xl overflow-visible">
          <div className="overflow-visible">
            <div className="relative">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M16 16l4 4" />
              </svg>

              <input
                type="search"
                value={searchText}
                onChange={(event) => {
                  const nextValue = event.target.value;

                  setSearchText(nextValue);
                  setSubmittedSearchText("");
                  setShowCategories(false);
                  setShowLiveMatches(Boolean(nextValue.trim()));
                }}
                onFocus={() => {
                  if (!searchText.trim()) {
                    setShowCategories(true);
                    setShowLiveMatches(false);
                  } else if (!submittedSearchText) {
                    setShowLiveMatches(true);
                  }
                }}
                onClick={() => {
                  if (!searchText.trim()) {
                    setShowCategories(true);
                    setShowLiveMatches(false);
                  } else if (!submittedSearchText) {
                    setShowLiveMatches(true);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitSearch();
                    event.currentTarget.blur();
                  }
                }}
                placeholder="Search businesses or categories"
                autoFocus={false}
                className="touch-manipulation h-12 w-full rounded-xl border border-gray-300 bg-white pl-12 pr-20 text-sm font-medium outline-none transition focus:border-[#1B365D] focus:ring-2 focus:ring-[#1B365D]/15"
              />

              {searchText && (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setSearchText("");
                    setSubmittedSearchText("");
                    setShowLiveMatches(false);
                    setShowCategories(false);
                  }}
                  aria-label="Clear search"
                  className="absolute right-12 top-1/2 z-10 -translate-y-1/2 text-xl text-gray-400"
                >
                  ×
                </button>
              )}

              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setShowCategories((current) => !current);
                }}
                aria-label="Show or hide categories"
                aria-expanded={showCategories}
                className="touch-manipulation absolute right-1 top-1/2 z-50 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg bg-white text-[#172033] transition active:scale-90"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`h-5 w-5 transition-transform ${
                    showCategories ? "rotate-180" : ""
                  }`}
                  aria-hidden="true"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </div>

            {showLiveMatches && searchText.trim() && !submittedSearchText && (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[10000] max-h-[60dvh] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl">
                {liveMatches.length > 0 ? (
                  <div className="space-y-1">
                    {liveMatches.map((business) => {
                      const categoryLabel =
                        getBusinessCategoryNames(business).join(", ") ||
                        "Business";

                      return (
                        <Link
                          key={business.id}
                          href={`/business/${business.id}?from=community-search`}
                          onClick={() => {
                            setShowLiveMatches(false);
                            setShowCategories(false);
                          }}
                          className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-[#F8F3EC] active:scale-[0.99]"
                        >
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                            <img
                              src={business.image_url || "/event.png"}
                              alt={business.name}
                              loading="lazy"
                              decoding="async"
                              className="h-full w-full object-cover"
                              onError={(event) => {
                                event.currentTarget.src = "/event.png";
                              }}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-black text-[#172033]">
                              {business.name}
                            </p>

                            <p className="mt-0.5 truncate text-xs font-medium text-gray-500">
                              {categoryLabel}
                              {business.city ? ` · ${business.city}` : ""}
                            </p>
                          </div>

                          <span className="shrink-0 text-lg text-gray-300">
                            ›
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-4 py-8 text-center">
                    <div className="text-2xl">🔍</div>
                    <p className="mt-2 text-sm font-black text-[#172033]">
                      No matching businesses
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Try another business name or category.
                    </p>
                  </div>
                )}
              </div>
            )}

            {showCategories && (
              <>
                <button
                  type="button"
                  aria-label="Close categories"
                  onClick={() => setShowCategories(false)}
                  onTouchStart={() => setShowCategories(false)}
                  className="fixed inset-0 z-[9990] cursor-default bg-transparent"
                />
                <div
                  onClick={(event) => event.stopPropagation()}
                  className="absolute left-0 right-0 top-[calc(100%+8px)] z-[9999] max-h-[55dvh] overflow-y-auto overscroll-contain rounded-2xl border border-gray-200 bg-white p-3 shadow-2xl [-webkit-overflow-scrolling:touch]"
                >
                  <div className="grid grid-cols-6 gap-x-1 gap-y-3">
                    <button
                      type="button"
                      onClick={() => selectCategory("all")}
                      className="flex min-w-0 flex-col items-center gap-2"
                    >
                      <span
                        className={`flex h-14 w-14 items-center justify-center rounded-full transition-all duration-200 ${
                          selectedCategory === "all"
                            ? "scale-105 bg-[#1B365D] text-white shadow-lg"
                            : "bg-[#F5F1EA] text-[#172033] hover:bg-[#ECE6DB] active:scale-95"
                        }`}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-7 w-7"
                          aria-hidden="true"
                        >
                          <circle cx="7" cy="7" r="2" />
                          <circle cx="17" cy="7" r="2" />
                          <circle cx="7" cy="17" r="2" />
                          <circle cx="17" cy="17" r="2" />
                        </svg>
                      </span>
                      <span className="w-full text-center text-[10px] font-bold leading-tight">
                        All
                      </span>
                    </button>

                    {sortedCategories.map((category) => {
                      const categoryId = String(category.id);
                      const selected = selectedCategory === categoryId;

                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => selectCategory(categoryId)}
                          className="flex min-w-0 flex-col items-center gap-2"
                        >
                          <span
                            className={`flex h-14 w-14 items-center justify-center rounded-full transition ${
                              selected
                                ? "bg-[#1B365D] text-white shadow-md"
                                : "bg-[#F5F1EA] text-[#172033] active:scale-90"
                            }`}
                          >
                            <CategoryIcon
                              name={category.name}
                              className="h-7 w-7"
                            />
                          </span>
                          <span className="w-full text-center text-[10px] font-bold leading-tight">
                            {category.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-xl px-4 pt-1 pb-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Business Directory
            </p>

            <h1 className="mt-1 truncate text-xl font-black">
              {searchText
                ? `"${searchText}" Search Results`
                : selectedCategory === "all"
                  ? "All Businesses"
                  : selectedCategoryName || "Businesses"}
            </h1>

            {!submittedSearchText && selectedCategory === "all" && (
              <p className="mt-1 text-xs text-gray-500">
                Coming Soon · Restaurant · Chicken · Bakery · Cafe
              </p>
            )}
          </div>

          <Link
            href="https://www.ktowntriangle.com/community/directory"
            className="shrink-0 rounded-full bg-[#F7A928] px-4 py-2 text-sm font-black text-[#172033] shadow-md transition hover:brightness-95 active:scale-95"
          >
            전체보기
          </Link>
        </div>

        {selectedCategory !== "all" && (
          <button
            type="button"
            onClick={() => {
              setSelectedCategory("all");
              setSearchText("");
              setSubmittedSearchText("");
              setShowLiveMatches(false);
              setShowCategories(false);
            }}
            className="mb-4 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-black shadow-sm"
          >
            View All Businesses
          </button>
        )}

        <div className="space-y-3">
          {filteredBusinesses.map((business) => {
            const categoryLabel =
              getBusinessCategoryNames(business).join(", ") || "Business";

            return (
              <Link
                key={business.id}
                href={`/business/${business.id}?from=community-search`}
                className="
                  flex items-center gap-4 overflow-hidden rounded-2xl
                  border border-gray-100 bg-white p-3
                  shadow-sm transition active:scale-[0.98]
                "
              >
                <div className="h-28 w-36 shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:h-28 sm:w-36">
                  <img
                    src={business.image_url || "/event.png"}
                    alt={business.name}
                    loading="lazy"
                    decoding="async"
                    className="!block !h-full !w-full !max-w-none !object-cover !object-center"
                    style={{
                      display: "block",
                      width: "100%",
                      height: "100%",
                      maxWidth: "none",
                      objectFit: "cover",
                      objectPosition: "center",
                    }}
                    onError={(event) => {
                      event.currentTarget.src = "/event.png";
                    }}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="line-clamp-1 text-base font-black">
                    {business.name}
                  </h2>

                  <p className="mt-1 line-clamp-1 text-sm font-medium text-gray-500">
                    {categoryLabel}
                    {business.city ? ` · ${business.city}` : ""}
                  </p>

                  <div className="mt-2 flex items-center gap-1 text-sm">
                    <span className="text-yellow-500">★</span>

                    <span className="font-black">
                      {Number(business.rating || 0).toFixed(1)}
                    </span>

                    {business.review_count ? (
                      <span className="text-xs text-gray-500">
                        ({Number(business.review_count).toLocaleString()})
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">No Reviews</span>
                    )}
                  </div>

                  {business.address && (
                    <p className="mt-1 line-clamp-1 text-xs text-gray-400">
                      {business.address}
                    </p>
                  )}
                </div>

                <span className="shrink-0 text-xl text-gray-300">›</span>
              </Link>
            );
          })}
        </div>

        {filteredBusinesses.length === 0 && (
          <div className="rounded-3xl border border-gray-100 bg-white px-5 py-12 text-center shadow-sm">
            <div className="text-4xl">🔍</div>

            <h2 className="mt-3 font-black">No businesses found</h2>

            <p className="mt-1 text-sm text-gray-500">
              Check whether the business category matches a Community Map
              category.
            </p>
          </div>
        )}
      </section>

      <CommunityBottomNav activeNav="search" />
    </main>
  );
}