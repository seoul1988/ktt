"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import BottomNav from "../components/BottomNav";

type Category = {
  id: number | string;
  name: string;
  show_on_main_map?: boolean | null;
  hidden?: boolean | null;
};

type Business = {
  id: number | string;
  name: string;
  category?: string | null;
  category_name?: string | null;
  categories?: unknown;
  city?: string | null;
  address?: string | null;
  image_url?: string | null;
  rating?: number | string | null;
  review_count?: number | null;
};

type SearchDirectoryProps = {
  categories: Category[];
  businesses: Business[];
};

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
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
  ];
}

function categoryNamesMatch(firstValue: string, secondValue: string) {
  const first = normalize(firstValue);
  const second = normalize(secondValue);

  if (!first || !second) {
    return false;
  }

  return first === second || first.includes(second) || second.includes(first);
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
    return (
      <svg {...commonProps}>
        <path d="M15.8 4.6c2.4 2.4 2.4 6.3 0 8.7-1.8 1.8-4.5 2.2-6.7 1.1l-2.6 2.6" />
        <path d="M8.3 15.2l-1.7-1.7" />
        <path d="M6.8 16.8l-1.4 1.4" />
        <path d="M5.5 18.1l-1.2 1.2" />
        <path d="M4.9 17.5l1.6 1.6" />
        <path d="M11.1 7.1c1.1-1.1 2.9-1.1 4 0" />
      </svg>
    );
  }

  if (
    category.includes("noodle") ||
    category.includes("국수") ||
    category.includes("라면")
  ) {
    return 4;
  }

  if (
    category.includes("cafe") ||
    category.includes("coffee") ||
    category.includes("dessert") ||
    category.includes("bakery") ||
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

  if (
    category.includes("noodle") ||
    category.includes("국수") ||
    category.includes("라면") ||
    category.includes("면요리")
  ) {
    return (
      <svg {...commonProps}>
        <path d="M5 11h14" />
        <path d="M6 11c0 5 2.5 8 6 8s6-3 6-8" />
        <path d="M8 7c0 1 1 1.5 1 2.5" />
        <path d="M12 6c0 1 1 1.5 1 2.5" />
        <path d="M16 7c0 1 1 1.5 1 2.5" />
      </svg>
    );
  }

  if (
    category.includes("bbq") ||
    category.includes("barbecue") ||
    category.includes("바베큐") ||
    category.includes("바비큐") ||
    category.includes("고기")
  ) {
    return (
      <svg {...commonProps}>
        <path d="M4 9h16" />
        <path d="M6 9c0 5 2.5 8 6 8s6-3 6-8" />
        <path d="M8 17l-1 4" />
        <path d="M16 17l1 4" />
        <path d="M8 5c0-1 1-1.5 1-2.5" />
        <path d="M12 5c0-1 1-1.5 1-2.5" />
        <path d="M16 5c0-1 1-1.5 1-2.5" />
      </svg>
    );
  }

  if (
    category.includes("sushi") ||
    category.includes("스시") ||
    category.includes("초밥")
  ) {
    return (
      <svg {...commonProps}>
        <ellipse cx="12" cy="8" rx="6.5" ry="3" />
        <path d="M5.5 8v7c0 1.7 2.9 3 6.5 3s6.5-1.3 6.5-3V8" />
        <path d="M9 8c.8-1.3 1.8-2 3-2s2.2.7 3 2" />
      </svg>
    );
  }

  if (
    category.includes("restaurant") ||
    category.includes("food") ||
    category.includes("dining") ||
    category.includes("식당") ||
    category.includes("레스토랑") ||
    category.includes("한식")
  ) {
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

  if (
    category.includes("cafe") ||
    category.includes("coffee") ||
    category.includes("dessert") ||
    category.includes("bakery") ||
    category.includes("카페") ||
    category.includes("커피") ||
    category.includes("디저트") ||
    category.includes("베이커리")
  ) {
    return (
      <svg {...commonProps}>
        <path d="M5 8h11v6a5 5 0 01-5 5H10a5 5 0 01-5-5V8z" />
        <path d="M16 10h2a2 2 0 010 4h-2" />
        <path d="M8 4c0 1 1 1.5 1 2.5" />
        <path d="M12 4c0 1 1 1.5 1 2.5" />
      </svg>
    );
  }

  if (
    category.includes("beauty") ||
    category.includes("hair") ||
    category.includes("salon") ||
    category.includes("spa") ||
    category.includes("nail") ||
    category.includes("뷰티") ||
    category.includes("미용") ||
    category.includes("헤어") ||
    category.includes("네일")
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

  if (
    category.includes("medical") ||
    category.includes("health") ||
    category.includes("clinic") ||
    category.includes("의료") ||
    category.includes("병원")
  ) {
    return (
      <svg {...commonProps}>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M12 8v8" />
        <path d="M8 12h8" />
      </svg>
    );
  }

  if (
    category.includes("dental") ||
    category.includes("dentist") ||
    category.includes("치과")
  ) {
    return (
      <svg {...commonProps}>
        <path d="M8 3c-3 0-4 2.5-4 5 0 3 1.5 4 2 7 .5 3 1 6 3 6 1.5 0 1.5-4 3-4s1.5 4 3 4c2 0 2.5-3 3-6 .5-3 2-4 2-7 0-2.5-1-5-4-5-1.5 0-2.5 1-4 1s-2.5-1-4-1z" />
      </svg>
    );
  }

  if (
    category.includes("auto") ||
    category.includes("car") ||
    category.includes("automotive") ||
    category.includes("자동차")
  ) {
    return (
      <svg {...commonProps}>
        <path d="M5 11l1.5-4h11L19 11" />
        <rect x="3" y="11" width="18" height="7" rx="2" />
        <circle cx="7" cy="18" r="1.5" />
        <circle cx="17" cy="18" r="1.5" />
      </svg>
    );
  }

  if (
    category.includes("real estate") ||
    category.includes("property") ||
    category.includes("부동산")
  ) {
    return (
      <svg {...commonProps}>
        <path d="M3 11l9-8 9 8" />
        <path d="M5 10v11h14V10" />
        <path d="M9 21v-7h6v7" />
      </svg>
    );
  }

  if (
    category.includes("education") ||
    category.includes("school") ||
    category.includes("academy") ||
    category.includes("교육") ||
    category.includes("학원")
  ) {
    return (
      <svg {...commonProps}>
        <path d="M3 9l9-5 9 5-9 5-9-5z" />
        <path d="M7 12v4c3 2 7 2 10 0v-4" />
        <path d="M21 9v6" />
      </svg>
    );
  }

  if (
    category.includes("travel") ||
    category.includes("hotel") ||
    category.includes("여행") ||
    category.includes("숙박")
  ) {
    return (
      <svg {...commonProps}>
        <path d="M2 16l20-8" />
        <path d="M9 13l-4-4" />
        <path d="M14 11l2-6" />
        <path d="M18 9l3 3" />
      </svg>
    );
  }

  if (
    category.includes("market") ||
    category.includes("grocery") ||
    category.includes("마트") ||
    category.includes("식품")
  ) {
    return (
      <svg {...commonProps}>
        <path d="M3 4h2l2 11h10l2-8H6" />
        <circle cx="9" cy="19" r="1.5" />
        <circle cx="17" cy="19" r="1.5" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <rect x="4" y="7" width="16" height="13" rx="2" />
      <path d="M9 7V5a3 3 0 016 0v2" />
      <path d="M4 12h16" />
    </svg>
  );
}

export default function SearchDirectory({
  categories,
  businesses,
}: SearchDirectoryProps) {
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showCategories, setShowCategories] = useState(false);

  const mainMapCategories = useMemo(() => {
    const hasMainMapField = categories.some(
      (category) =>
        typeof category.show_on_main_map === "boolean",
    );

    const hasHiddenField = categories.some(
      (category) => typeof category.hidden === "boolean",
    );

    return categories.filter((category) => {
      const isMainMapCategory = hasMainMapField
        ? category.show_on_main_map === true
        : true;

      const isVisible = hasHiddenField
        ? category.hidden !== true
        : true;

      return isMainMapCategory && isVisible;
    });
  }, [categories]);

  const mainMapCategoryNames = useMemo(() => {
    return mainMapCategories.map((category) => category.name);
  }, [mainMapCategories]);

  const sortedCategories = useMemo(() => {
    return [...mainMapCategories].sort((a, b) => {
      const rankDifference =
        getCategorySortRank(a.name) - getCategorySortRank(b.name);

      if (rankDifference !== 0) {
        return rankDifference;
      }

      return a.name.localeCompare(b.name);
    });
  }, [mainMapCategories]);

  const selectedCategoryName = useMemo(() => {
    if (selectedCategory === "all") {
      return "";
    }

    return (
      mainMapCategories.find(
        (category) => String(category.id) === selectedCategory,
      )?.name || ""
    );
  }, [mainMapCategories, selectedCategory]);

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

        return a.name.localeCompare(b.name);
      })
      .slice(0, 8);
  }, [businesses, searchText]);

  const filteredBusinesses = useMemo(() => {
    const keyword = normalize(searchText);

    return businesses
      .filter((business) => {
        const businessCategoryNames = getBusinessCategoryNames(business);

        const belongsToMainMapCategory =
          businessCategoryNames.some((businessCategoryName) =>
            mainMapCategoryNames.some((mainCategoryName) =>
              categoryNamesMatch(
                businessCategoryName,
                mainCategoryName,
              ),
            ),
          );

        if (!belongsToMainMapCategory) {
          return false;
        }

        const matchesCategory =
          selectedCategory === "all" ||
          businessCategoryNames.some((businessCategoryName) =>
            categoryNamesMatch(
              businessCategoryName,
              selectedCategoryName,
            ),
          );

        const searchableText = normalize(
          [
            business.name,
            ...businessCategoryNames,
            business.city,
            business.address,
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

        return a.name.localeCompare(b.name);
      });
  }, [
    businesses,
    mainMapCategoryNames,
    searchText,
    selectedCategory,
    selectedCategoryName,
  ]);

  function selectCategory(categoryId: string) {
    setSelectedCategory(categoryId);
    setShowCategories(false);
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
                  setSearchText(event.target.value);
                  setShowCategories(false);
                }}
                onFocus={() => {
                  if (!searchText.trim()) {
                    setShowCategories(true);
                  }
                }}
                onClick={() => {
                  if (!searchText.trim()) {
                    setShowCategories(true);
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

            {searchText.trim() && (
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
                          href={`/business/${business.id}?from=search`}
                          onClick={() => setShowCategories(false)}
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

                          <span className="shrink-0 text-lg text-gray-300">›</span>
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
    ? "bg-[#1B365D] text-white shadow-lg scale-105"
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

            {!searchText && selectedCategory === "all" && (
              <p className="mt-1 text-xs text-gray-500">
                Restaurant · BBQ · Sushi · Noodles
              </p>
            )}
          </div>

          <span className="shrink-0 rounded-full bg-[#1B365D] px-3 py-1.5 text-xs font-black text-white">
            {filteredBusinesses.length}
          </span>
        </div>

        {selectedCategory !== "all" && (
          <button
            type="button"
            onClick={() => {
              setSelectedCategory("all");
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
  href={`/business/${business.id}?from=search`}
  className="
                  flex items-center gap-4 overflow-hidden rounded-2xl
                  border border-gray-100 bg-white p-3
                  shadow-sm transition
                  active:scale-[0.98]
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
              Check whether the business category matches a Main App Map
              category.
            </p>
          </div>
        )}
      </section>

      <BottomNav activeNav="search" />
    </main>
  );
}