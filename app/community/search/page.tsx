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
  const { data: visibleCategories, error: categoryError } =
    await supabase
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
      show_on_community_map: category.show_on_community_map,
    }),
  );

  const { data: allBusinesses, error: businessError } =
    await supabase
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

  const visibleBusinesses = (allBusinesses ?? []).filter(
    (business: any) =>
      isVisibleCategoryBusiness(
        business,
        allowedCategoryNames,
      ),
  );

  return (
    <main className="min-h-[100dvh] bg-[#F8F3EC]">
      {/*
       * layout.tsx의 app-safe-area는 그대로 둡니다.
       * 이 페이지에서는 헤더 내용만 16px 아래로 내려
       * 아이폰 카메라/노치 뒤에 숨지 않게 합니다.
       */}
      <header className="fixed inset-x-0 top-0 z-[100] h-[72px] border-b border-black/5 bg-[#F8F3EC]/95 backdrop-blur-md">
        <div className="relative mx-auto flex h-full max-w-xl items-center justify-between px-4 pt-4">
          <div className="flex w-12 shrink-0 items-center justify-start">
            <BackButton />
          </div>

          <h1 className="pointer-events-none absolute left-1/2 top-[calc(50%+8px)] max-w-[calc(100%-120px)] -translate-x-1/2 -translate-y-1/2 truncate text-2xl font-black tracking-tight text-[#172033]">
            Businesses
          </h1>

          <div className="flex w-12 shrink-0 items-center justify-end">
            <ProfileButton />
          </div>
        </div>
      </header>

      {/*
       * 헤더가 56px에서 72px로 커졌으므로 본문도 72px 아래에서 시작합니다.
       * 검색 컴포넌트 내부 구조는 변경하지 않습니다.
       */}
      <div className="pt-[72px] [&_header]:top-[72px]">
        <CommunitySearchDirectory
          categories={categories}
          businesses={visibleBusinesses}
        />
      </div>
    </main>
  );
}