// app/community/directory/page.tsx

import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import CommunityBottomNav from "../../components/CommunityBottomNav";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Category = {
  id?: number;
  name: string;
  emoji: string | null;
  show_on_main_map?: boolean | null;
  show_on_community_map?: boolean | null;
  show_on_b2b?: boolean | null;
};

function normalizeCategory(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9가-힣]/g, "")
    .replace(/s$/, "");
}

function parseOrderValue(...values: any[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") {
      continue;
    }

    const parsed = Number(String(value).trim());

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function splitCategories(value: any) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getAddress(item: any) {
  return (
    item.address ||
    item.full_address ||
    item.formatted_address ||
    item.location ||
    [item.street, item.city, item.state, item.zip]
      .filter(Boolean)
      .join(", ")
  );
}

function getPhone(item: any) {
  return item.phone || item.phone_number || "";
}

function getCityFromAddress(item: any) {
  const address = String(getAddress(item) || "");

  const parts = address
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return parts[1];
  }

  return item.city || "";
}

function getMapUrl(item: any) {
  const address = getAddress(item);

  const query = encodeURIComponent(
    address || item.name || "",
  );

  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function DirectionsIcon() {
  return (
    <span className="relative block h-5 w-5">
      <span className="absolute left-[5px] top-[3px] h-[15px] w-[2px] bg-[#172033]" />
      <span className="absolute left-[5px] top-[3px] h-[2px] w-[11px] bg-[#172033]" />
      <span className="absolute left-[11px] top-[1px] h-[8px] w-[8px] rotate-45 border-r-2 border-t-2 border-[#172033]" />
    </span>
  );
}

function PhoneIcon() {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#C4483A] text-sm font-black text-white shadow-sm">
      ☎
    </span>
  );
}

type SearchParams = Promise<{
  back?: string;
}>;

export default async function CommunityDirectoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { back } = await searchParams;

  const safeBackHref =
    typeof back === "string" &&
    back.startsWith("/") &&
    !back.startsWith("//")
      ? back
      : "/community/search";

  const directoryReturnHref =
    `/community/directory?back=${encodeURIComponent(safeBackHref)}`;


  /*
   * Hidden 상태를 판단하기 위해 카테고리 표시 옵션을 모두 가져옵니다.
   *
   * Hidden은 별도 컬럼이 아니라 아래 세 값이 모두 false인 상태입니다.
   * - show_on_main_map
   * - show_on_community_map
   * - show_on_b2b
   */
  const {
    data: categoriesData,
    error: categoriesError,
  } = await supabase
    .from("categories")
    .select(
      "id, name, emoji, show_on_main_map, show_on_community_map, show_on_b2b",
    )
    .order("name", {
      ascending: true,
    });

  if (categoriesError) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] p-5 text-[#172033]">
        <p className="font-bold text-red-600">
          카테고리 불러오기 실패: {categoriesError.message}
        </p>
      </main>
    );
  }

  const allCategories = (
    (categoriesData || []) as Category[]
  ).filter((category) =>
    Boolean(category.name?.trim()),
  );

  /*
   * Main, Community, B2B가 모두 꺼진 카테고리는 Hidden입니다.
   * Hidden 카테고리는 디렉토리 그룹에서 제외합니다.
   */
  const categoryList = allCategories.filter(
    (category) =>
      category.show_on_main_map === true ||
      category.show_on_community_map === true ||
      category.show_on_b2b === true,
  );

  const hiddenCategoryNames = new Set(
    allCategories
      .filter(
        (category) =>
          category.show_on_main_map !== true &&
          category.show_on_community_map !== true &&
          category.show_on_b2b !== true,
      )
      .map((category) =>
        normalizeCategory(category.name),
      )
      .filter(Boolean),
  );

  function isHiddenCategory(
    value: string | null | undefined,
  ) {
    return hiddenCategoryNames.has(
      normalizeCategory(value),
    );
  }

  const categoryById = new Map(
    categoryList
      .filter((category) => category.id)
      .map((category) => [
        Number(category.id),
        category,
      ]),
  );

  const categoryEmojiMap = new Map(
    categoryList.map((category) => [
      normalizeCategory(category.name),
      category.emoji,
    ]),
  );

  const {
    data: businesses,
    error: businessesError,
  } = await supabase
    .from("businesses")
    .select("*")
    .order("name", {
      ascending: true,
    });

  if (businessesError) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] p-5 text-[#172033]">
        <p className="font-bold text-red-600">
          업체 리스트 불러오기 실패:{" "}
          {businessesError.message}
        </p>
      </main>
    );
  }

  const {
    data: businessCategoryRows,
    error: businessCategoriesError,
  } = await supabase
    .from("business_categories")
    .select("*");

  if (businessCategoriesError) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] p-5 text-[#172033]">
        <p className="font-bold text-red-600">
          업체 카테고리 연결정보 불러오기 실패:{" "}
          {businessCategoriesError.message}
        </p>
      </main>
    );
  }

  type LinkedCategory = {
    name: string;
    order: number | null;
  };

  const businessCategoryMap = new Map<
    number,
    LinkedCategory[]
  >();

  (businessCategoryRows || []).forEach((row: any) => {
    const businessId = Number(row.business_id);
    const categoryId = Number(row.category_id);

    /*
     * business_categories 연결 정보를 사용해
     * 업체를 카테고리별로 분류합니다.
     */
    const category = categoryById.get(categoryId);

    if (!businessId || !category?.name) {
      return;
    }

    const parsedOrder = parseOrderValue(
      row.order,
      row.sort_order,
      row.display_order,
      row.category_order,
      row.order_index,
      row.sort_index,
      row.position,
      row.sequence,
      row.priority,
      row.rank,
    );

    const current =
      businessCategoryMap.get(businessId) || [];

    current.push({
      name: category.name,
      order: parsedOrder,
    });

    businessCategoryMap.set(
      businessId,
      current,
    );
  });

  const businessList =
    businesses
      ?.map((business: any) => {
        const linkedCategories =
          businessCategoryMap.get(
            Number(business.id),
          ) || [];

        /*
         * 문자열 카테고리를 fallback으로 사용할 때도
         * Hidden 카테고리는 제외합니다.
         */
        const fallbackCategories = splitCategories(
          business.category ||
            business.categories ||
            business.business_category ||
            business.type ||
            business.tags ||
            "",
        ).filter(
          (categoryName) =>
            !isHiddenCategory(categoryName),
        );

        const linkedCategoryNames =
          linkedCategories
            .map((category) => category.name)
            .filter(
              (categoryName) =>
                !isHiddenCategory(categoryName),
            );

        const rawCategories = [
          ...linkedCategoryNames,
          ...fallbackCategories,
        ];

        const uniqueCategories = Array.from(
          new Set(
            rawCategories
              .map((categoryName) =>
                String(categoryName).trim(),
              )
              .filter(Boolean)
              .filter(
                (categoryName) =>
                  !isHiddenCategory(categoryName),
              ),
          ),
        );

        const categoryOrderMap: Record<
          string,
          number | null
        > = {};

        linkedCategories.forEach((category) => {
          categoryOrderMap[
            normalizeCategory(category.name)
          ] = category.order;
        });

        const businessOrder = parseOrderValue(
          business.order,
          business.sort_order,
          business.display_order,
          business.category_order,
          business.order_index,
          business.sort_index,
          business.position,
          business.sequence,
          business.priority,
          business.rank,
        );

        return {
          ...business,

          matched_categories:
            uniqueCategories.length > 0
              ? uniqueCategories
              : ["Other"],

          category_order_map:
            categoryOrderMap,

          business_order:
            businessOrder,
        };
      })
      .filter(Boolean) || [];

  const categoryNames = Array.from(
    new Set(
      businessList.flatMap(
        (business: any) =>
          business.matched_categories || [],
      ),
    ),
  )
    .sort((a: string, b: string) =>
      a.localeCompare(b, "ko"),
    );

  const groupedByCategory = categoryNames
    .map((categoryName) => {
      const normalizedCategory =
        normalizeCategory(categoryName);

      const items = businessList
        .filter((business: any) =>
          business.matched_categories.some(
            (category: string) =>
              normalizeCategory(category) ===
              normalizedCategory,
          ),
        )
        .sort((a: any, b: any) => {
          const categoryOrderA =
            a.category_order_map?.[
              normalizedCategory
            ] ?? null;

          const categoryOrderB =
            b.category_order_map?.[
              normalizedCategory
            ] ?? null;

          const orderA =
            categoryOrderA ??
            a.business_order ??
            Number.MAX_SAFE_INTEGER;

          const orderB =
            categoryOrderB ??
            b.business_order ??
            Number.MAX_SAFE_INTEGER;

          if (orderA !== orderB) {
            return orderA - orderB;
          }

          return String(
            a.name || "",
          ).localeCompare(
            String(b.name || ""),
            "ko",
          );
        });

      return {
        name: categoryName,
        emoji:
          categoryEmojiMap.get(
            normalizedCategory,
          ) || "📍",
        items,
      };
    })
    .filter(
      (
        group,
      ): group is {
        name: string;
        emoji: string;
        items: any[];
      } =>
        Boolean(
          group &&
            group.items.length > 0,
        ),
    );

  /*
   * businesses 테이블에 등록된 전체 업체 수입니다.
   */
  const registeredBusinessCount =
    businesses?.length || 0;

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-3 pb-28 pt-5 text-[#172033]">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center justify-between">
          <Link
            href={safeBackHref}
            className="rounded-full bg-white px-4 py-2 text-sm font-black shadow"
          >
            ← Back
          </Link>

          <h1 className="text-lg font-black tracking-wide">
            한인 비즈니스
          </h1>

          <div className="w-[72px]" />
        </div>

        <div className="mb-5 rounded-3xl bg-[#C4483A] px-5 py-4 text-white shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-black">
                🌐 모두보기
              </h2>

              <p className="mt-1 text-sm font-semibold opacity-90">
                전체 카테고리별 업체 리스트
              </p>
            </div>

            <div className="shrink-0 rounded-full bg-white/20 px-3 py-2 text-right shadow-sm backdrop-blur-sm">
              <p className="text-[10px] font-black uppercase tracking-wide opacity-90">
                등록된 비즈니스 업체
              </p>

              <p className="mt-0.5 text-lg font-black leading-none">
                {registeredBusinessCount.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-7">
          {groupedByCategory.map((group) => (
            <section key={group.name}>
              <div className="mb-2 flex items-center gap-2 border-b border-gray-300 pb-2">
                <span className="text-2xl">
                  {group.emoji}
                </span>

                <h2 className="text-lg font-black">
                  {group.name}
                </h2>

                <span className="rounded-full bg-white px-2 py-1 text-xs font-black text-gray-500 shadow-sm">
                  {group.items.length}
                </span>
              </div>

              <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="grid grid-cols-[1fr_82px_42px_70px] border-b bg-gray-100 px-3 py-2 text-[11px] font-black text-gray-500">
                  <div>Business</div>

                  <div className="text-center">
                    City
                  </div>

                  <div className="text-center">
                    Call
                  </div>

                  <div className="text-center">
                    Directions
                  </div>
                </div>

                <div className="divide-y divide-gray-200">
                  {group.items.map(
                    (business: any) => {
                      const phone =
                        getPhone(business);

                      const city =
                        getCityFromAddress(
                          business,
                        );

                      return (
                        <div
                          key={`${group.name}-${business.id}`}
                          className="grid grid-cols-[1fr_82px_42px_70px] items-center gap-2 px-3 py-2 text-xs"
                        >
                          <Link
                            href={`/business/${business.id}?from=community-directory&returnTo=${encodeURIComponent(
                              directoryReturnHref,
                            )}`}
                            className="min-w-0 break-words font-black leading-tight text-[#172033]"
                          >
                            {business.name}
                          </Link>

                          <div className="flex justify-center">
                            {city ? (
                              <span className="max-w-[80px] truncate rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-700">
                                {city}
                              </span>
                            ) : (
                              <span className="text-gray-300">
                                —
                              </span>
                            )}
                          </div>

                          <div className="flex justify-center">
                            {phone ? (
                              <a
                                href={`tel:${phone}`}
                                aria-label={`Call ${business.name}`}
                              >
                                <PhoneIcon />
                              </a>
                            ) : (
                              <span className="text-gray-300">
                                —
                              </span>
                            )}
                          </div>

                          <a
                            href={getMapUrl(
                              business,
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-col items-center justify-center text-[#172033] active:scale-95"
                          >
                            <DirectionsIcon />

                            <span className="mt-0.5 text-[8px] font-bold leading-none">
                              Directions
                            </span>
                          </a>
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            </section>
          ))}

          {groupedByCategory.length === 0 && (
            <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
              <p className="font-black text-gray-500">
                표시할 비즈니스가 없습니다.
              </p>
            </div>
          )}
        </div>
      </div>

      <CommunityBottomNav activeNav="map" />
    </main>
  );
}