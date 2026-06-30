// app/community/directory/page.tsx

import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import CommunityBottomNav from "../../components/CommunityBottomNav";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CommunityCategory = {
  name: string;
  emoji: string | null;
};

function normalizeCategory(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function splitCategories(value: string | null | undefined) {
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
    [item.street, item.city, item.state, item.zip].filter(Boolean).join(", ")
  );
}

function getPhone(item: any) {
  return item.phone || item.phone_number || "";
}

function formatPhone(phone: string | null | undefined) {
  if (!phone) return "";

  const digits = phone.replace(/\D/g, "");

  // 미국 11자리(1 포함)
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)})-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  // 미국 10자리
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)})-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // 그 외는 원본 반환
  return phone;
}

function getCityFromAddress(item: any) {
  const address = String(getAddress(item) || "");

  const parts = address
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  if (parts.length >= 2) return parts[1];

  return item.city || "";
}

function getMapUrl(item: any) {
  const address = getAddress(item);
  const query = encodeURIComponent(address || item.name || "");
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

export default async function CommunityDirectoryPage() {
  const { data: communityCategories } = await supabase
    .from("categories")
    .select("name, emoji")
    .eq("show_on_community_map", true)
    .order("name", { ascending: true });

  const categoryList = (communityCategories || []) as CommunityCategory[];

  const allowedCategoryNames = new Set(
    categoryList.map((category) => normalizeCategory(category.name))
  );

  const { data: businesses, error } = await supabase
    .from("businesses")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] p-5 text-[#172033]">
        <p className="font-bold text-red-600">
          업체 리스트 불러오기 실패: {error.message}
        </p>
      </main>
    );
  }

  const communityBusinesses =
    businesses
      ?.map((business: any) => {
        const rawCategories = splitCategories(
          business.category || business.categories || ""
        );

        const matchedCategories = rawCategories.filter((cat) =>
          allowedCategoryNames.has(normalizeCategory(cat))
        );

        if (matchedCategories.length === 0) return null;

        return {
          ...business,
          matched_categories: matchedCategories,
        };
      })
      .filter(Boolean) || [];

  const groupedByCategory = categoryList
    .map((category) => {
      const normalizedCategory = normalizeCategory(category.name);

      const items = communityBusinesses
        .filter((business: any) =>
          business.matched_categories.some(
            (cat: string) => normalizeCategory(cat) === normalizedCategory
          )
        )
        .sort((a: any, b: any) =>
          String(a.name || "").localeCompare(String(b.name || ""), "ko")
        );

      return {
        name: category.name,
        emoji: category.emoji || "📍",
        items,
      };
    })
    .filter((group) => group.items.length > 0);

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

          <h1 className="text-lg font-black tracking-wide">한인 비즈니스</h1>

          <div className="w-[72px]" />
        </div>

        <div className="mb-5 rounded-3xl bg-[#C4483A] px-5 py-4 text-white shadow-lg">
          <h2 className="text-xl font-black">🌐 모두보기</h2>
          <p className="mt-1 text-sm font-semibold opacity-90">
            카테고리별 업체 리스트
          </p>
        </div>

        <div className="space-y-7">
          {groupedByCategory.map((group) => (
            <section key={group.name}>
              <div className="mb-2 flex items-center gap-2 border-b border-gray-300 pb-2">
                <span className="text-2xl">{group.emoji}</span>
                <h2 className="text-lg font-black">{group.name}</h2>
                <span className="rounded-full bg-white px-2 py-1 text-xs font-black text-gray-500 shadow-sm">
                  {group.items.length}
                </span>
              </div>

              <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="grid grid-cols-[1fr_86px_112px_70px] border-b bg-gray-100 px-3 py-2 text-[11px] font-black text-gray-500">
                  <div>Business</div>
                  <div className="text-center">City</div>
                  <div>Phone</div>
                  <div className="text-center">Directions</div>
                </div>

                <div className="divide-y divide-gray-200">
                  {group.items.map((business: any) => {
                    const phone = formatPhone(getPhone(business));
                    const city = getCityFromAddress(business);

                    return (
                      <div
                        key={`${group.name}-${business.id}`}
                        className="grid grid-cols-[1fr_86px_112px_70px] items-center gap-2 px-3 py-2 text-xs"
                      >
                        <Link
                          href={`/business/${business.id}?from=community-directory`}
                          className="min-w-0 truncate font-black text-[#172033]"
                        >
                          {business.name}
                        </Link>

                        <div className="flex justify-center">
                          {city ? (
                            <span className="max-w-[84px] truncate rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-700">
                              {city}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </div>

                        {phone ? (
                          <a
                            href={`tel:${phone}`}
                            className="truncate font-bold text-[#C4483A]"
                          >
                            {phone}
                          </a>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}

                        <a
                          href={getMapUrl(business)}
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
                  })}
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>

      <CommunityBottomNav activeNav="map" />
    </main>
  );
}