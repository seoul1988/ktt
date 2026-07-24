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
   * 메인 지도에 표시하도록 설정된 카테고리만 가져옵니다.
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
   * 숨김 상태가 아닌 비즈니스만 가져옵니다.
   * hidden이 null인 기존 비즈니스도 포함합니다.
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

  const allowedCategoryNames = new Set<string>(
    categories
      .map((category: any) =>
        normalizeCategory(category.name),
      )
      .filter(Boolean),
  );

  /*
   * 메인 지도에 표시되는 카테고리에 속한
   * 비즈니스만 검색 페이지로 전달합니다.
   */
  const visibleBusinesses = (
    allBusinesses ?? []
  ).filter((business: any) =>
    isMainCategoryBusiness(
      business,
      allowedCategoryNames,
    ),
  );

  return (
    <main className="min-h-[100dvh] bg-[#F8F3EC]">
      {/*
       * 아이폰 노치 및 상태바 영역의 배경색입니다.
       */}
      <div className="fixed inset-x-0 top-0 z-[99] h-[env(safe-area-inset-top)] bg-[#F8F3EC]" />

      {/*
       * 헤더 자체에만 safe-area를 적용합니다.
       * 제목, 뒤로가기, 프로필 버튼이 아이폰 상태바 뒤로
       * 들어가지 않도록 합니다.
       */}
      <header
        className="
          fixed inset-x-0 top-0 z-[100]
          border-b border-black/5
          bg-[#F8F3EC]/95
          pt-[env(safe-area-inset-top)]
          backdrop-blur-md
        "
      >
        <div className="relative mx-auto flex h-14 max-w-xl items-center justify-between px-4">
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

      {/*
       * 본문에는 safe-area를 다시 더하지 않습니다.
       *
       * 헤더 높이 56px만 적용하고,
       * 아이폰에서는 검색창을 위쪽으로 당겨
       * 제목과 검색 입력창 사이의 큰 빈 공간을 줄입니다.
       */}
      <div
        className="
          pt-14
          [@supports(padding-top:env(safe-area-inset-top))]:pt-[calc(3.5rem+env(safe-area-inset-top))]
        "
      >
        <div
          className="
            -mt-2
            [@supports(padding-top:env(safe-area-inset-top))]:-mt-[env(safe-area-inset-top)]
          "
        >
          <SearchDirectory
            categories={categories}
            businesses={visibleBusinesses}
          />
        </div>
      </div>
    </main>
  );
}