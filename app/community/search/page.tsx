export const dynamic = "force-dynamic";
export const revalidate = 0;

import BackButton from "../../components/BackButton";
import ProfileButton from "../../components/ProfileButton";
import { supabase } from "../../../lib/supabase";
import CommunitySearchDirectory from "./CommunitySearchDirectory";

function normalizeCategory(value: unknown) {
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

function isVisibleCategoryBusiness(
  business: any,
  allowedCategoryNames: Set<string>,
) {
  if (!business || allowedCategoryNames.size === 0) {
    return false;
  }

  const businessCategoryNames = [
    ...splitCategories(business.category),
    ...splitCategories(business.category_name),
    ...splitCategories(business.categories),
  ];

  return businessCategoryNames.some((categoryName) =>
    allowedCategoryNames.has(normalizeCategory(categoryName)),
  );
}

export default async function CommunitySearchPage() {
  /*
   * Community 검색 페이지이므로 show_on_community_map이 true인
   * 카테고리만 가져옵니다.
   *
   * categories 테이블에는 hidden 컬럼이 없으므로 hidden을 조회하지 않습니다.
   */
  const {
    data: visibleCategories,
    error: categoryError,
  } = await supabase
    .from("categories")
    .select("id, name, show_on_community_map")
    .eq("show_on_community_map", true)
    .order("name", { ascending: true });

  if (categoryError) {
    console.warn(
      "Community search category load error:",
      categoryError.message,
      categoryError.code,
    );
  }

  /*
   * show_on_community_map 값을 포함해 전달합니다.
   * 클라이언트에서도 안전하게 사용할 수 있습니다.
   */
  const categories = (visibleCategories ?? []).map(
    (category: any) => ({
      id: category.id,
      name: category.name,
      show_on_community_map: category.show_on_community_map,
    }),
  );

  /*
   * businesses 테이블에서 hidden이 true인 비즈니스만 제외합니다.
   * hidden이 null 또는 false인 비즈니스는 포함합니다.
   */
  const {
    data: allBusinesses,
    error: businessError,
  } = await supabase
    .from("businesses")
    .select("*")
    .or("hidden.is.null,hidden.eq.false")
    .order("name", { ascending: true });

  if (businessError) {
    console.warn(
      "Community search business load error:",
      businessError.message,
      businessError.code,
    );
  }

  const allowedCategoryNames = new Set<string>(
    categories
      .map((category) => normalizeCategory(category.name))
      .filter(Boolean),
  );

  /*
   * Community Map에 표시되는 카테고리와 정확히 일치하는
   * 비즈니스만 검색 목록에 전달합니다.
   */
  const visibleBusinesses = (allBusinesses ?? []).filter(
    (business: any) =>
      isVisibleCategoryBusiness(
        business,
        allowedCategoryNames,
      ),
  );

  return (
  <main className="min-h-[100dvh] bg-[#F8F3EC]">
    {/* 아이폰 상태바 영역 배경 */}
    <div className="fixed inset-x-0 top-0 z-[99] h-[env(safe-area-inset-top)] bg-[#F8F3EC]" />

    {/* 아이폰 상태바 아래에 헤더 배치 */}
    <header
      className="
        fixed inset-x-0
        top-[env(safe-area-inset-top)]
        z-[100]
        h-14
        border-b border-black/5
        bg-[#F8F3EC]/95
        backdrop-blur-md
      "
    >
      <div className="relative mx-auto flex h-full max-w-xl items-center justify-between px-4">
        <div className="flex w-12 shrink-0 items-center justify-start">
          <BackButton />
        </div>

        <h1
          className="
            pointer-events-none
            absolute left-1/2
            max-w-[calc(100%-120px)]
            -translate-x-1/2
            truncate
            text-2xl font-black
            tracking-tight
            text-[#172033]
          "
        >
          Businesses
        </h1>

        <div className="flex w-12 shrink-0 items-center justify-end">
          <ProfileButton />
        </div>
      </div>
    </header>

    {/* 상태바 높이 + 헤더 56px만큼 본문 내리기 */}
    <div
      className="
        pt-[calc(env(safe-area-inset-top)+3.5rem)]
        [&_header]:top-[calc(env(safe-area-inset-top)+3.5rem)]
      "
    >
      <CommunitySearchDirectory
        categories={categories}
        businesses={visibleBusinesses}
      />
    </div>
  </main>
);
}