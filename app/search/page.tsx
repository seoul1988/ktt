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

  const visibleBusinesses = (
    allBusinesses || []
  ).filter((business: any) =>
    isMainCategoryBusiness(
      business,
      allowedCategoryNames,
    ),
  );

  return (
    <main className="min-h-[100dvh] bg-[#F8F3EC]">
      {/* 아이폰 상태바·노치 영역 배경 */}
      <div className="fixed inset-x-0 top-0 z-[99] h-[env(safe-area-inset-top)] bg-[#F8F3EC]" />

      {/* safe area 아래에 헤더 표시 */}
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

      {/* safe area + 헤더 높이만큼 본문 내리기 */}
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