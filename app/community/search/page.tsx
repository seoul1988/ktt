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
    allowedCategoryNames.has(
      normalizeCategory(categoryName),
    ),
  );
}

export default async function CommunitySearchPage() {
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

  const categories = (visibleCategories ?? []).map(
    (category: any) => ({
      id: category.id,
      name: category.name,
      show_on_community_map:
        category.show_on_community_map,
    }),
  );

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
      .map((category) =>
        normalizeCategory(category.name),
      )
      .filter(Boolean),
  );

  const visibleBusinesses = (allBusinesses ?? []).filter(
    (business: any) =>
      isVisibleCategoryBusiness(
        business,
        allowedCategoryNames,
      ),
  );

  return (
    <main className="min-h-[100dvh] bg-[#F8F3EC] text-[#172033]">
      {/*
       * 헤더와 검색 본문을 같은 문서 흐름에 둡니다.
       * 페이지 전체가 아이폰 safe area 아래에서 시작하고,
       * 위쪽에 16px의 추가 여백을 둡니다.
       *
       * fixed/sticky가 아니므로 스크롤하면
       * 헤더도 검색 본문과 함께 위로 사라집니다.
       */}
      <section className="mx-auto w-full max-w-xl pt-[calc(env(safe-area-inset-top)+1rem)]">
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

        <CommunitySearchDirectory
          categories={categories}
          businesses={visibleBusinesses}
        />
      </section>
    </main>
  );
}