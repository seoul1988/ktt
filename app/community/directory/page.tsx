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
};

const HIDDEN_DIRECTORY_CATEGORIES = new Set([
  "beautysupply",
]);

function normalizeCategory(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9가-힣]/g, "")
    .replace(/s$/, "");
}

function isHiddenDirectoryCategory(
  value: string | null | undefined,
) {
  return HIDDEN_DIRECTORY_CATEGORIES.has(
    normalizeCategory(value),
  );
}

function parseOrderValue(...values: any[]) {
  for (const value of values) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      continue;
    }

    const parsed = Number(
      String(value).trim(),
    );

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function splitCategories(value: any) {
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v).trim())
      .filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function getAddress(item: any) {
  return (
    item.address ||
    item.full_address ||
    item.formatted_address ||
    item.location ||
    [
      item.street,
      item.city,
      item.state,
      item.zip,
    ]
      .filter(Boolean)
      .join(", ")
  );
}

function getPhone(item: any) {
  return (
    item.phone ||
    item.phone_number ||
    ""
  );
}

function getCityFromAddress(item: any) {
  const address = String(
    getAddress(item) || "",
  );

  const parts = address
    .split(",")
    .map((v) => v.trim())
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

export default async function CommunityDirectoryPage() {
  const { data: categoriesData } =
    await supabase
      .from("categories")
      .select("id, name, emoji")
      .order("name", {
        ascending: true,
      });

  /*
   * 디렉토리에서 Beauty Supply 카테고리를 제거합니다.
   * 지도나 다른 페이지에는 영향을 주지 않습니다.
   */
  const categoryList = (
    (categoriesData || []) as Category[]
  ).filter(
    (category) =>
      !isHiddenDirectoryCategory(
        category.name,
      ),
  );

  const categoryById = new Map(
    categoryList
      .filter(
        (category) => category.id,
      )
      .map((category) => [
        Number(category.id),
        category,
      ]),
  );

  const categoryEmojiMap = new Map(
    categoryList.map((category) => [
      normalizeCategory(
        category.name,
      ),
      category.emoji,
    ]),
  );

  const {
    data: businesses,
    error,
  } = await supabase
    .from("businesses")
    .select("*")
    .order("name", {
      ascending: true,
    });

  if (error) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] p-5 text-[#172033]">
        <p className="font-bold text-red-600">
          업체 리스트 불러오기 실패:{" "}
          {error.message}
        </p>
      </main>
    );
  }

  const registeredBusinessCount = businesses?.length || 0;

  const {
    data: businessCategoryRows,
  } = await supabase
    .from("business_categories")
    .select("*");

  type LinkedCategory = {
    name: string;
    order: number | null;
  };

  const businessCategoryMap =
    new Map<
      number,
      LinkedCategory[]
    >();

  (
    businessCategoryRows || []
  ).forEach((row: any) => {
    const businessId = Number(
      row.business_id,
    );

    const categoryId = Number(
      row.category_id,
    );

    const category =
      categoryById.get(categoryId);

    /*
     * Beauty Supply는 categoryById에서 이미 제거됐으므로
     * 이 연결 정보도 디렉토리에 포함되지 않습니다.
     */
    if (
      !businessId ||
      !category?.name
    ) {
      return;
    }

    const parsedOrder =
      parseOrderValue(
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
      businessCategoryMap.get(
        businessId,
      ) || [];

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

        const fallbackCategories =
          splitCategories(
            business.category ||
              business.categories ||
              business.business_category ||
              business.type ||
              business.tags ||
              "",
          ).filter(
            (categoryName) =>
              !isHiddenDirectoryCategory(
                categoryName,
              ),
          );

        const linkedCategoryNames =
          linkedCategories
            .map(
              (category) =>
                category.name,
            )
            .filter(
              (categoryName) =>
                !isHiddenDirectoryCategory(
                  categoryName,
                ),
            );

        const rawCategories = [
          ...linkedCategoryNames,
          ...fallbackCategories,
        ];

        const uniqueCategories =
          Array.from(
            new Set(
              rawCategories
                .map((cat) =>
                  String(cat).trim(),
                )
                .filter(Boolean)
                .filter(
                  (categoryName) =>
                    !isHiddenDirectoryCategory(
                      categoryName,
                    ),
                ),
            ),
          );

        const categoryOrderMap: Record<
          string,
          number | null
        > = {};

        linkedCategories.forEach(
          (category) => {
            if (
              isHiddenDirectoryCategory(
                category.name,
              )
            ) {
              return;
            }

            categoryOrderMap[
              normalizeCategory(
                category.name,
              )
            ] = category.order;
          },
        );

        const businessOrder =
          parseOrderValue(
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

  /*
   * Beauty Supply 카테고리 이름을
   * 디렉토리 그룹 목록에서 제외합니다.
   */
  const categoryNames =
    Array.from(
      new Set(
        businessList.flatMap(
          (business: any) =>
            business.matched_categories ||
            [],
        ),
      ),
    )
      .filter(
        (categoryName: string) =>
          !isHiddenDirectoryCategory(
            categoryName,
          ),
      )
      .sort(
        (
          a: string,
          b: string,
        ) =>
          a.localeCompare(
            b,
            "ko",
          ),
      );

  const groupedByCategory =
    categoryNames
      .map((categoryName) => {
        const normalizedCategory =
          normalizeCategory(
            categoryName,
          );

        /*
         * 마지막 단계에서도 Beauty Supply 그룹을 방지합니다.
         */
        if (
          isHiddenDirectoryCategory(
            categoryName,
          )
        ) {
          return null;
        }

        const items =
          businessList
            .filter(
              (business: any) =>
                business.matched_categories.some(
                  (
                    cat: string,
                  ) =>
                    normalizeCategory(
                      cat,
                    ) ===
                    normalizedCategory,
                ),
            )
            .sort(
              (
                a: any,
                b: any,
              ) => {
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

                if (
                  orderA !== orderB
                ) {
                  return (
                    orderA -
                    orderB
                  );
                }

                return String(
                  a.name || "",
                ).localeCompare(
                  String(
                    b.name || "",
                  ),
                  "ko",
                );
              },
            );

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
              group.items.length >
                0,
          ),
      );

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-3 pb-28 pt-5 text-[#172033]">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center justify-between">
          <Link
            href="/community/map"
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
          {groupedByCategory.map(
            (group) => (
              <section
                key={group.name}
              >
                <div className="mb-2 flex items-center gap-2 border-b border-gray-300 pb-2">
                  <span className="text-2xl">
                    {group.emoji}
                  </span>

                  <h2 className="text-lg font-black">
                    {group.name}
                  </h2>

                  <span className="rounded-full bg-white px-2 py-1 text-xs font-black text-gray-500 shadow-sm">
                    {
                      group.items
                        .length
                    }
                  </span>
                </div>

                <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                  <div className="grid grid-cols-[1fr_82px_42px_70px] border-b bg-gray-100 px-3 py-2 text-[11px] font-black text-gray-500">
                    <div>
                      Business
                    </div>

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
                      (
                        business: any,
                      ) => {
                        const phone =
                          getPhone(
                            business,
                          );

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
                              href={`/business/${business.id}?from=community-directory`}
                              className="min-w-0 break-words font-black leading-tight text-[#172033]"
                            >
                              {
                                business.name
                              }
                            </Link>

                            <div className="flex justify-center">
                              {city ? (
                                <span className="max-w-[80px] truncate rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-700">
                                  {
                                    city
                                  }
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
            ),
          )}
        </div>
      </div>

      <CommunityBottomNav activeNav="map" />
    </main>
  );
}