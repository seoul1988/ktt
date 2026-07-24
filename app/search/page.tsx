export const dynamic = "force-dynamic";
export const revalidate = 0;

import BackButton from "../components/BackButton";
import ProfileButton from "../components/ProfileButton";
import { supabase } from "../../lib/supabase";
import SearchDirectory from "./SearchDirectory";

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

function categoryNamesMatch(
  businessCategoryName: string,
  allowedCategoryName: string,
) {
  const businessName = normalizeCategory(
    businessCategoryName,
  );

  const allowedName = normalizeCategory(
    allowedCategoryName,
  );

  if (!businessName || !allowedName) {
    return false;
  }

  /*
   * 부분 일치를 사용하지 않고 정확히 같은 카테고리만 허용합니다.
   *
   * 예:
   * Beauty !== Beauty Supply
   * Restaurant !== Korean Restaurant
   */
  return businessName === allowedName;
}

function isMainCategoryBusiness(
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
    allowedCategoryNames.has(
      normalizeCategory(categoryName),
    ),
  );
}

export default async function SearchPage() {
  /*
   * Main App Map에 체크된 카테고리만 가져옵니다.
   */
  const {
    data: mainCategories,
    error: categoryError,
  } = await supabase
    .from("categories")
    .select("id, name")
    .eq("show_on_main_map", true)
    .order("name", { ascending: true });

  if (categoryError) {
    console.warn(
      "Search category load error:",
      categoryError.message,
      categoryError.code,
    );
  }

  const categories = mainCategories || [];

  /*
   * 숨김 처리되지 않은 비즈니스만 가져옵니다.
   * hidden 값이 null인 기존 데이터도 포함합니다.
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
      "Search business load error:",
      businessError.message,
      businessError.code,
    );
  }

  /*
   * Main App Map 카테고리 이름 목록을 만듭니다.
   */
  const allowedCategoryNames = new Set<string>(
    categories
      .map((category: any) =>
        normalizeCategory(category.name),
      )
      .filter(Boolean),
  );

  /*
   * Main App Map 카테고리 이름과 정확히 일치하는
   * 카테고리에 속한 비즈니스만 표시합니다.
   */
  const visibleBusinesses = (allBusinesses || []).filter(
    (business: any) =>
      isMainCategoryBusiness(
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
      <SearchDirectory
        categories={categories}
        businesses={visibleBusinesses}
      />
    </div>
  </main>
);
}