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

  const categories = mainCategories ?? [];

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
   * Main App Map 카테고리에 속한 비즈니스만 표시합니다.
   */
  const visibleBusinesses = (allBusinesses ?? []).filter(
    (business: any) =>
      isMainCategoryBusiness(
        business,
        allowedCategoryNames,
      ),
  );

  return (
    <main className="min-h-[100dvh] bg-[#F8F3EC] text-[#172033]">
      {/*
       * layout.tsx의 app-safe-area가 아이폰 상태바 여백을
       * 이미 처리하므로 여기서는 safe-area를 다시 더하지 않습니다.
       *
       * 헤더와 검색 본문을 같은 흐름에 두고 위쪽에 8px만 추가합니다.
       * 스크롤하면 헤더와 본문이 함께 위로 사라집니다.
       */}
      <section className="mx-auto w-full max-w-xl pt-2">
        <header className="relative flex h-14 items-center justify-between border-b border-black/5 px-4">
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
        </header>

        <SearchDirectory
          categories={categories}
          businesses={visibleBusinesses}
        />
      </section>
    </main>
  );
}