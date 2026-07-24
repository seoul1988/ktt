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
      show_on_community_map:
        category.show_on_community_map,
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
      .map((category) =>
        normalizeCategory(category.name),
      )
      .filter(Boolean),
  );

  const visibleBusinesses = (
    allBusinesses ?? []
  ).filter((business: any) =>
    isVisibleCategoryBusiness(
      business,
      allowedCategoryNames,
    ),
  );

  return (
    <main className="min-h-[100dvh] bg-[#F8F3EC]">
      {/* 아이폰 노치 및 상태바 영역까지 배경색 채우기 */}
      <div className="fixed inset-x-0 top-0 z-[99] h-[env(safe-area-inset-top)] bg-[#F8F3EC]" />

      {/* 아이폰 안전 영역 아래부터 헤더 시작 */}
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

      {/* safe-area 높이 + 헤더 56px만큼 본문 내리기 */}
    <div
  className="
    pt-[calc(env(safe-area-inset-top)+3.5rem)]
    [&_header]:top-[calc(env(safe-area-inset-top)+3.5rem)]
  "
>
  <div className="-mt-3">
    <SearchDirectory
      categories={categories}
      businesses={visibleBusinesses}
    />
  </div>
</div>
    </main>
  );
}