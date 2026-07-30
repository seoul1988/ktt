"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import CommunityBottomNav from "../../components/CommunityBottomNav";
import ProfileButton from "@/app/components/ProfileButton";
import BackButton from "@/app/components/BackButton";

export const dynamic = "force-dynamic";

type Business = {
  id: number;
  name: string | null;
  address: string | null;
  phone: string | null;
  category: string | null;
  display_order: number | null;
  featured_sponsor: boolean | null;

  // 메인, 지도, 검색 숨김 여부
  hidden: boolean | null;

  // 비즈니스 사이트 관리 활성화 여부
  website_enabled: boolean | null;
  website_enabled_at: string | null;
  website_enabled_by: string | null;

  // 커스텀 도메인: 프로토콜/www 없이 저장
  custom_domain: string | null;
};

export default function AdminBusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);

  const [savingId, setSavingId] = useState<number | null>(null);
  const [sponsorSavingId, setSponsorSavingId] =
    useState<number | null>(null);

  const [hiddenSavingId, setHiddenSavingId] =
    useState<number | null>(null);

  const [websiteSavingId, setWebsiteSavingId] =
    useState<number | null>(null);

  const [domainSavingId, setDomainSavingId] =
    useState<number | null>(null);

  const [domains, setDomains] =
    useState<Record<number, string>>({});

  const [orders, setOrders] = useState<Record<number, string>>({});
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadBusinesses();
  }, []);

  async function loadBusinesses() {
    setLoading(true);

    const { data, error } = await supabase
      .from("businesses")
      .select(
        `
          id,
          name,
          address,
          phone,
          category,
          display_order,
          featured_sponsor,
          hidden,
          website_enabled,
          website_enabled_at,
          website_enabled_by,
          custom_domain
        `,
      )
      .order("category", {
        ascending: true,
        nullsFirst: false,
      })
      .order("display_order", {
        ascending: true,
        nullsFirst: false,
      })
      .order("id", {
        ascending: false,
      });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const rows = (data || []) as Business[];

    setBusinesses(rows);

    const nextOrders: Record<number, string> = {};
    const nextDomains: Record<number, string> = {};

    rows.forEach((business) => {
      nextOrders[business.id] = String(
        business.display_order ?? 999,
      );

      nextDomains[business.id] =
        business.custom_domain ?? "";
    });

    setOrders(nextOrders);
    setDomains(nextDomains);
    setLoading(false);
  }

  const groupedBusinesses = useMemo(() => {
    const groups: Record<string, Business[]> = {};
    const keyword = searchTerm.trim().toLowerCase();

    const filteredBusinesses = businesses.filter((business) => {
      if (!keyword) {
        return true;
      }

      const searchableValues = [
        business.name,
        business.address,
        business.phone,
        business.category,
        business.custom_domain,
      ];

      return searchableValues.some((value) =>
        value?.toLowerCase().includes(keyword),
      );
    });

    filteredBusinesses.forEach((business) => {
      const category =
        business.category?.trim() || "No Category";

      if (!groups[category]) {
        groups[category] = [];
      }

      groups[category].push(business);
    });

    Object.values(groups).forEach((items) => {
      items.sort((a, b) => {
        const orderA = a.display_order ?? 999;
        const orderB = b.display_order ?? 999;

        if (orderA !== orderB) {
          return orderA - orderB;
        }

        return (a.name || "").localeCompare(b.name || "");
      });
    });

    return Object.entries(groups).sort(
      ([categoryA], [categoryB]) =>
        categoryA.localeCompare(categoryB),
    );
  }, [businesses, searchTerm]);

  const filteredBusinessCount = useMemo(() => {
    return groupedBusinesses.reduce(
      (total, [, items]) => total + items.length,
      0,
    );
  }, [groupedBusinesses]);

  const hiddenBusinessCount = useMemo(() => {
    return businesses.filter(
      (business) => business.hidden === true,
    ).length;
  }, [businesses]);

  async function saveDisplayOrder(id: number) {
    const value = Number(orders[id] || 999);

    if (Number.isNaN(value)) {
      alert("숫자만 입력하세요.");
      return;
    }

    setSavingId(id);

    const { error } = await supabase
      .from("businesses")
      .update({
        display_order: value,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      setSavingId(null);
      return;
    }

    setBusinesses((prev) =>
      prev.map((business) =>
        business.id === id
          ? {
              ...business,
              display_order: value,
            }
          : business,
      ),
    );

    setSavingId(null);
  }

  async function toggleFeaturedSponsor(
    id: number,
    currentValue: boolean | null,
  ) {
    const nextValue = !Boolean(currentValue);

    setSponsorSavingId(id);

    const { error } = await supabase
      .from("businesses")
      .update({
        featured_sponsor: nextValue,
      })
      .eq("id", id);

    if (error) {
      alert(
        "Featured Sponsor 변경 실패: " + error.message,
      );

      setSponsorSavingId(null);
      return;
    }

    setBusinesses((prev) =>
      prev.map((business) =>
        business.id === id
          ? {
              ...business,
              featured_sponsor: nextValue,
            }
          : business,
      ),
    );

    setSponsorSavingId(null);
  }

  async function toggleHidden(
    id: number,
    currentValue: boolean | null,
  ) {
    const nextValue = !Boolean(currentValue);

    setHiddenSavingId(id);

    const { error } = await supabase
      .from("businesses")
      .update({
        hidden: nextValue,
      })
      .eq("id", id);

    if (error) {
      alert(
        "숨김 상태 변경 실패: " + error.message,
      );

      setHiddenSavingId(null);
      return;
    }

    setBusinesses((prev) =>
      prev.map((business) =>
        business.id === id
          ? {
              ...business,
              hidden: nextValue,
            }
          : business,
      ),
    );

    setHiddenSavingId(null);
  }

  async function toggleWebsiteEnabled(
    id: number,
    currentValue: boolean | null,
  ) {
    const nextValue = !Boolean(currentValue);

    const actionText = nextValue
      ? "사이트 관리 기능을 열어줄까요?"
      : "사이트 관리 기능을 닫을까요?";

    const ok = window.confirm(actionText);

    if (!ok) {
      return;
    }

    setWebsiteSavingId(id);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        alert("관리자 로그인 정보를 확인할 수 없습니다.");
        return;
      }

      const { error } = await supabase
        .from("businesses")
        .update({
          website_enabled: nextValue,
          website_enabled_at: nextValue
            ? new Date().toISOString()
            : null,
          website_enabled_by: nextValue
            ? user.id
            : null,
        })
        .eq("id", id);

      if (error) {
        alert(
          "사이트 관리 상태 변경 실패: " +
            error.message,
        );
        return;
      }

      setBusinesses((prev) =>
        prev.map((business) =>
          business.id === id
            ? {
                ...business,
                website_enabled: nextValue,
                website_enabled_at: nextValue
                  ? new Date().toISOString()
                  : null,
                website_enabled_by: nextValue
                  ? user.id
                  : null,
              }
            : business,
        ),
      );

      alert(
        nextValue
          ? "사이트 관리 기능을 활성화했습니다."
          : "사이트 관리 기능을 비활성화했습니다.",
      );
    } finally {
      setWebsiteSavingId(null);
    }
  }

  function normalizeCustomDomain(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .split(":")[0]
      .replace(/\.$/, "");
  }

  function isValidCustomDomain(value: string) {
    if (!value) return true;

    if (
      value === "localhost" ||
      value === "ktowntriangle.com" ||
      value.endsWith(".vercel.app")
    ) {
      return false;
    }

    return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
      value,
    );
  }

  async function saveCustomDomain(
    id: number,
    businessName: string | null,
  ) {
    const normalized = normalizeCustomDomain(
      domains[id] ?? "",
    );

    if (!isValidCustomDomain(normalized)) {
      alert(
        "올바른 도메인을 입력하세요. 예: example.com\\nhttps://, www, 경로는 입력하지 마세요.",
      );
      return;
    }

    const actionText = normalized
      ? `"${businessName || "Business"}"에 ${normalized} 도메인을 연결할까요?`
      : `"${businessName || "Business"}"의 커스텀 도메인을 삭제할까요?`;

    if (!window.confirm(actionText)) {
      return;
    }

    setDomainSavingId(id);

    try {
      const { error } = await supabase
        .from("businesses")
        .update({
          custom_domain: normalized || null,
        })
        .eq("id", id);

      if (error) {
        if (
          error.code === "23505" ||
          error.message.toLowerCase().includes("duplicate")
        ) {
          alert(
            "이 도메인은 이미 다른 비즈니스에 연결되어 있습니다.",
          );
        } else {
          alert(
            "도메인 저장 실패: " + error.message,
          );
        }
        return;
      }

      setDomains((prev) => ({
        ...prev,
        [id]: normalized,
      }));

      setBusinesses((prev) =>
        prev.map((business) =>
          business.id === id
            ? {
                ...business,
                custom_domain: normalized || null,
              }
            : business,
        ),
      );

      alert(
        normalized
          ? `도메인을 저장했습니다.\\n\\n다음 단계:\\n1. Vercel Domains에 ${normalized} 추가\\n2. Vercel Domains에 www.${normalized} 추가\\n3. 도메인 회사에서 Vercel이 안내하는 A/CNAME 설정`
          : "커스텀 도메인을 삭제했습니다.",
      );
    } finally {
      setDomainSavingId(null);
    }
  }

  async function deleteBusiness(
    id: number,
    name: string | null,
  ) {
    const ok = window.confirm(
      `"${name || "No name"}" business를 삭제할까요?`,
    );

    if (!ok) {
      return;
    }

    const { error: ownerError } = await supabase
      .from("business_owners")
      .delete()
      .eq("business_id", id);

    if (ownerError) {
      alert(
        "business_owners 삭제 실패: " +
          ownerError.message,
      );

      return;
    }

    const { error: businessError } = await supabase
      .from("businesses")
      .delete()
      .eq("id", id);

    if (businessError) {
      alert(
        "businesses 삭제 실패: " +
          businessError.message,
      );

      return;
    }

    setBusinesses((prev) =>
      prev.filter((business) => business.id !== id),
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-5 pb-28 pt-8 text-[#172033]">
      <div className="mx-auto w-full max-w-xl">
        {/* 상단 타이틀 */}
        <div className="relative mb-4 flex h-10 items-center border-b border-[#E8DED1] pb-3">
          <BackButton />

          <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-xl font-black text-[#172033]">
            Businesses
          </h1>

          <div className="ml-auto">
            <ProfileButton />
          </div>
        </div>

        {/* 검색창 */}
        <div className="mb-5">
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-gray-400">
              🔍
            </span>

            <input
              type="text"
              value={searchTerm}
              onChange={(e) =>
                setSearchTerm(e.target.value)
              }
              placeholder="Search businesses..."
              autoComplete="off"
              className="w-full rounded-2xl border border-[#E8DED1] bg-white py-3 pl-11 pr-11 text-sm font-bold text-[#172033] shadow-sm outline-none transition placeholder:font-medium placeholder:text-gray-400 focus:border-[#172033] focus:ring-2 focus:ring-[#172033]/10"
            />

            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                aria-label="Clear search"
                className="absolute right-4 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-gray-100 text-lg font-black leading-none text-gray-500 hover:bg-gray-200 hover:text-[#172033]"
              >
                ×
              </button>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between px-1">
            <span className="text-xs font-bold text-gray-500">
              {searchTerm
                ? `${filteredBusinessCount} result${
                    filteredBusinessCount === 1
                      ? ""
                      : "s"
                  }`
                : `${businesses.length} businesses`}
            </span>

            <span className="text-xs font-bold text-gray-500">
              숨김 {hiddenBusinessCount}개
            </span>
          </div>

          <p className="mt-1 px-1 text-right text-[11px] font-bold text-gray-400">
            낮은 숫자가 먼저 노출
          </p>
        </div>

        {loading ? (
          <div className="rounded-3xl bg-white p-5 font-bold shadow">
            Loading...
          </div>
        ) : businesses.length === 0 ? (
          <div className="rounded-3xl bg-white p-6 text-center shadow">
            <p className="text-lg font-black text-[#172033]">
              No businesses found.
            </p>
          </div>
        ) : groupedBusinesses.length === 0 ? (
          <div className="rounded-3xl bg-white p-6 text-center shadow">
            <p className="text-lg font-black text-[#172033]">
              No matching businesses
            </p>

            <p className="mt-2 text-sm font-medium text-gray-500">
              다른 상호명, 주소, 전화번호 또는 카테고리로
              검색해 보세요.
            </p>

            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="mt-4 rounded-xl bg-[#172033] px-5 py-2.5 text-sm font-bold text-white"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <div className="space-y-7">
            {groupedBusinesses.map(
              ([category, items]) => (
                <section key={category}>
                  {/* 카테고리 타이틀 */}
                  <div className="mb-3 rounded-2xl bg-[#172033] px-4 py-1.5 text-white shadow">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="min-w-0 truncate text-lg font-black">
                        {category}
                      </h2>

                      <span className="shrink-0 text-xs font-bold text-white/70">
                        {items.length}
                      </span>
                    </div>
                  </div>

                  {/* 업체 목록 */}
                  <div className="space-y-4">
                    {items.map((business) => (
                      <div
                        key={business.id}
                        className={`rounded-3xl bg-white p-5 shadow ${
                          business.hidden
                            ? "border-2 border-red-300 opacity-75"
                            : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="break-words text-xl font-black">
                                {business.name ||
                                  "No business name"}
                              </h3>

                              {business.featured_sponsor && (
                                <span className="rounded-full bg-yellow-400 px-2.5 py-1 text-[11px] font-black text-black">
                                  ⭐ Sponsor
                                </span>
                              )}

                              {business.hidden && (
                                <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-black text-red-700">
                                  숨김
                                </span>
                              )}

                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                                  business.website_enabled
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-200 text-gray-700"
                                }`}
                              >
                                {business.website_enabled
                                  ? "🟢 Website ON"
                                  : "🔴 Website OFF"}
                              </span>

                              {business.custom_domain && (
                                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-black text-blue-700">
                                  🌐 Domain
                                </span>
                              )}
                            </div>

                            <p className="mt-1 break-words text-sm text-gray-600">
                              {business.address ||
                                "No address"}
                            </p>

                            {business.phone && (
                              <p className="mt-1 text-sm text-gray-600">
                                Phone: {business.phone}
                              </p>
                            )}
                          </div>

                          {/* 노출 순서 */}
                          <div className="shrink-0 text-right">
                            <p className="text-[11px] font-black text-gray-500">
                              ORDER
                            </p>

                            <input
                              type="number"
                              inputMode="numeric"
                              value={
                                orders[business.id] ??
                                "999"
                              }
                              onChange={(e) =>
                                setOrders((prev) => ({
                                  ...prev,
                                  [business.id]:
                                    e.target.value,
                                }))
                              }
                              className="mt-1 w-20 rounded-xl border border-gray-200 px-3 py-2 text-center text-sm font-black outline-none focus:border-[#172033] focus:ring-2 focus:ring-[#172033]/10"
                            />
                          </div>
                        </div>

                        {/* 관리 버튼 */}
                   



				           {/* 관리 버튼 */}
<div className="mt-4 flex flex-nowrap items-center gap-1 overflow-x-auto">
  <button
    type="button"
    onClick={() => saveDisplayOrder(business.id)}
    disabled={savingId === business.id}
    className="shrink-0 rounded-lg bg-green-600 px-2.5 py-1.5 text-[11px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:text-xs"
  >
    {savingId === business.id ? "Saving..." : "Save"}
  </button>

  <button
    type="button"
    onClick={() =>
      toggleFeaturedSponsor(
        business.id,
        business.featured_sponsor
      )
    }
    disabled={sponsorSavingId === business.id}
    className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold shadow-sm disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:text-xs ${
      business.featured_sponsor
        ? "bg-yellow-400 text-black"
        : "bg-gray-200 text-gray-700"
    }`}
  >
    {sponsorSavingId === business.id
      ? "Saving..."
      : business.featured_sponsor
        ? "⭐ Sponsor"
        : "Sponsor"}
  </button>

  <button
    type="button"
    onClick={() =>
      toggleWebsiteEnabled(
        business.id,
        business.website_enabled,
      )
    }
    disabled={websiteSavingId === business.id}
    className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:text-xs ${
      business.website_enabled
        ? "bg-green-600"
        : "bg-gray-500"
    }`}
  >
    {websiteSavingId === business.id
      ? "Saving..."
      : business.website_enabled
        ? "Website ON"
        : "Website OFF"}
  </button>

  <Link
    href={`/business/${business.id}/edit`}
    className="shrink-0 rounded-lg bg-[#172033] px-2.5 py-1.5 text-[11px] font-bold text-white sm:px-3 sm:text-xs"
  >
    Edit
  </Link>

  <button
    type="button"
    onClick={() =>
      deleteBusiness(
        business.id,
        business.name
      )
    }
    className="shrink-0 rounded-lg bg-red-500 px-2.5 py-1.5 text-[11px] font-bold text-white sm:px-3 sm:text-xs"
  >
    Delete
  </button>

  <label className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-bold sm:text-xs">
    <input
      type="checkbox"
      checked={Boolean(business.hidden)}
      disabled={hiddenSavingId === business.id}
      onChange={() =>
        toggleHidden(
          business.id,
          business.hidden
        )
      }
      className="h-3.5 w-3.5 accent-red-600"
    />

    {hiddenSavingId === business.id
      ? "Saving..."
      : "Hide"}
  </label>
</div>

                        <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-black text-[#172033]">
                                🌐 Website Domain
                              </p>
                              <p className="mt-0.5 text-[10px] font-bold text-gray-500">
                                https://와 www 없이 한 번만 입력
                              </p>
                            </div>

                            {business.custom_domain && (
                              <a
                                href={`https://${business.custom_domain}`}
                                target="_blank"
                                rel="noreferrer"
                                className="shrink-0 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-black text-blue-700 shadow-sm"
                              >
                                Open ↗
                              </a>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={domains[business.id] ?? ""}
                              onChange={(e) =>
                                setDomains((prev) => ({
                                  ...prev,
                                  [business.id]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  saveCustomDomain(
                                    business.id,
                                    business.name,
                                  );
                                }
                              }}
                              placeholder="example.com"
                              autoCapitalize="none"
                              autoCorrect="off"
                              spellCheck={false}
                              className="min-w-0 flex-1 rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-sm font-bold text-[#172033] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                            />

                            <button
                              type="button"
                              onClick={() =>
                                saveCustomDomain(
                                  business.id,
                                  business.name,
                                )
                              }
                              disabled={
                                domainSavingId === business.id
                              }
                              className="shrink-0 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {domainSavingId === business.id
                                ? "Saving..."
                                : "Save Domain"}
                            </button>
                          </div>

                          {business.custom_domain ? (
                            <div className="mt-2 rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-blue-700">
                              연결 도메인: {business.custom_domain}
                              <br />
                              Vercel에는 {business.custom_domain}과
                              {" "}www.{business.custom_domain}을 추가하세요.
                            </div>
                          ) : (
                            <p className="mt-2 text-[11px] font-bold text-gray-500">
                              비워서 저장하면 기존 도메인 연결이 삭제됩니다.
                            </p>
                          )}
                        </div>

                        {business.hidden && (
                          <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                            이 업체는 사용자 메인 목록,
                            지도 및 검색 결과에서 숨겨진
                            상태입니다.
                          </div>
                        )}

                        <div
                          className={`mt-3 rounded-xl px-3 py-2 text-xs font-bold ${
                            business.website_enabled
                              ? "bg-green-50 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {business.website_enabled
                            ? "오너가 카테고리, 품목, 가격 및 웹사이트 관리 기능을 사용할 수 있습니다."
                            : "사이트 관리가 비활성화되어 있습니다. Website OFF 버튼을 눌러 열어주세요."}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ),
            )}
          </div>
        )}
      </div>

      <CommunityBottomNav activeNav="admin" />
    </main>
  );
}