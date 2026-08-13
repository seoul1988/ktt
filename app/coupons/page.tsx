"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import BottomNav from "../components/BottomNav";
import ProfileButton from "../components/ProfileButton";

type Business = {
  id: number;
  name: string | null;
  category: string | null;
  address: string | null;
  image_url: string | null;
  image_urls: string[] | null;
};

type Coupon = {
  id: number;
  business_id: number;
  title: string;
  description: string | null;
  end_date: string | null;
  active: boolean;
  image_url: string | null;
};

function categoriesOf(value: string | null) {
  return String(value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export default function CouponsPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const [businessResult, couponResult] = await Promise.all([
      supabase
        .from("businesses")
        .select("id,name,category,address,image_url,image_urls")
        .order("name", { ascending: true }),
      supabase
        .from("coupons")
        .select("id,business_id,title,description,end_date,active,image_url")
        .eq("active", true)
        .order("created_at", { ascending: false }),
    ]);

    if (businessResult.error) {
      alert(businessResult.error.message);
      setLoading(false);
      return;
    }

    if (couponResult.error) {
      alert(couponResult.error.message);
      setLoading(false);
      return;
    }

    setBusinesses((businessResult.data || []) as Business[]);
    setCoupons((couponResult.data || []) as Coupon[]);
    setLoading(false);
  }

  const appCategories = [
    { id: "ALL", label: "All", icon: "◉" },
    { id: "FOOD", label: "Food", icon: "🍴" },
    { id: "MARKET", label: "Market", icon: "🛒" },
    { id: "BEAUTY", label: "Beauty", icon: "✂" },
    { id: "AUTO", label: "Auto", icon: "🚗" },
    { id: "OTHER", label: "Other", icon: "•••" },
  ] as const;

  function matchesAppCategory(business: Business, selected: string) {
    if (selected === "ALL") return true;

    const values = categoriesOf(business.category).map((v) => v.toLowerCase());
    const joined = values.join(" ");

    const food =
      joined.includes("restaurant") ||
      joined.includes("food") ||
      joined.includes("cafe") ||
      joined.includes("bakery") ||
      joined.includes("chicken") ||
      joined.includes("korean") ||
      joined.includes("chinese") ||
      joined.includes("japanese") ||
      joined.includes("dessert");

    const market =
      joined.includes("market") ||
      joined.includes("grocery") ||
      joined.includes("mart");

    const beauty =
      joined.includes("beauty") ||
      joined.includes("hair") ||
      joined.includes("salon") ||
      joined.includes("spa") ||
      joined.includes("nail");

    const auto =
      joined.includes("auto") ||
      joined.includes("car") ||
      joined.includes("automotive");

    if (selected === "FOOD") return food;
    if (selected === "MARKET") return market;
    if (selected === "BEAUTY") return beauty;
    if (selected === "AUTO") return auto;
    if (selected === "OTHER") return !food && !market && !beauty && !auto;

    return true;
  }

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const businessMap = new Map(businesses.map((b) => [b.id, b]));
    const map = new Map<number, { business: Business; coupons: Coupon[] }>();

    coupons.forEach((coupon) => {
      if (coupon.end_date && new Date(coupon.end_date) < new Date()) return;

      const business = businessMap.get(coupon.business_id);
      if (!business) return;

      if (!matchesAppCategory(business, category)) return;

      const text = [
        business.name,
        business.category,
        business.address,
        coupon.title,
        coupon.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (q && !text.includes(q)) return;

      const existing = map.get(business.id);
      if (existing) existing.coupons.push(coupon);
      else map.set(business.id, { business, coupons: [coupon] });
    });

    return Array.from(map.values()).sort((a, b) =>
      String(a.business.name || "").localeCompare(String(b.business.name || "")),
    );
  }, [businesses, coupons, search, category]);

  return (
    <main className="min-h-screen bg-[#F5F5F5] pb-20 text-[#151821]">
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-white">
        <header className="sticky top-0 z-30 border-b border-[#ECECEC] bg-white">
          <div className="flex h-12 items-center justify-between px-4">
            <button
              type="button"
              onClick={() => history.back()}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[26px] leading-none text-[#222]"
              aria-label="Back"
            >
              ‹
            </button>

            <h1 className="text-[15px] font-black tracking-[0.02em] text-[#E9413B]">
              COUPONS
            </h1>

            <div className="scale-90">
              <ProfileButton />
            </div>
          </div>

          <div className="px-4 pb-3">
            <div className="relative">
              <svg
                viewBox="0 0 24 24"
                className="pointer-events-none absolute left-3 top-1/2 h-[17px] w-[17px] -translate-y-1/2 fill-none stroke-[#9CA3AF]"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m16.5 16.5 4 4" />
              </svg>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search stores or coupons"
                className="h-10 w-full rounded-[10px] border border-[#E4E6E8] bg-white pl-9 pr-3 text-[12px] font-semibold outline-none placeholder:text-[#A7ADB7] focus:border-[#F06A64]"
              />
            </div>

            <div className="mt-3">
              <div className="grid grid-cols-6 gap-1">
                {appCategories.map((item) => {
                  const selected = category === item.id;

                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => setCategory(item.id)}
                      className="flex min-w-0 flex-col items-center gap-1"
                    >
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-[14px] leading-none ${
                          selected
                            ? "bg-[#EB4A45] text-white"
                            : "bg-[#F2F3F5] text-[#555]"
                        }`}
                      >
                        {item.icon}
                      </span>

                      <span
                        className={`block w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-[9px] font-bold ${
                          selected ? "text-[#EB4A45]" : "text-[#737984]"
                        }`}
                      >
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {category === "FOOD" && (
                <div className="mt-2 flex items-center gap-4 overflow-x-auto border-t border-[#F1F1F1] pt-2 text-[9px] font-bold text-[#6F7580] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <span className="shrink-0 text-[#EB4A45]">All</span>
                  <span className="shrink-0">Korean</span>
                  <span className="shrink-0">Chicken</span>
                  <span className="shrink-0">Chinese</span>
                  <span className="shrink-0">Japanese</span>
                  <span className="shrink-0">Snack</span>
                  <span className="shrink-0">Cafe</span>
                </div>
              )}
            </div>          </div>
        </header>

        <section className="px-3 pb-4 pt-2">
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="text-[10px] font-black text-[#EB4A45]">
              {appCategories.find((item) => item.id === category)?.label || "All"}
            </span>
            <span className="text-[9px] font-bold text-[#A0A6AF]">
              {groups.length} stores
            </span>
          </div>

          {loading ? (
            <div className="py-16 text-center text-[12px] font-bold text-gray-400">
              Loading coupons...
            </div>
          ) : groups.length === 0 ? (
            <div className="py-20 text-center">
  <div className="text-5xl">🎟️</div>
  <p className="mt-4 text-[16px] font-black">
    No coupons available.
  </p>
</div>
          ) : (
            <div>
              {groups.map(({ business, coupons }) => {
                const image =
                  coupons.find((c) => c.image_url)?.image_url ||
                  business.image_url ||
                  business.image_urls?.[0] ||
                  "";

                const firstCoupon = coupons[0];

                return (
                  <button
                    type="button"
                    key={business.id}
                    onClick={() => {
                      window.location.href = `/coupons/business/${business.id}`;
                    }}
                    className="flex w-full items-center gap-3 border-b border-[#EEEEEE] px-1 py-2.5 text-left active:bg-[#FAFAFA]"
                  >
                    <div className="h-[62px] w-[82px] shrink-0 overflow-hidden rounded-[6px] bg-[#F2F2F2]">
                      {image ? (
                        <img
                          src={image}
                          alt={business.name || ""}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-2xl">
                          🏪
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] font-black uppercase text-[#3C424D]">
                        {business.name || "LOCAL BUSINESS"}
                      </p>

                      <h3 className="mt-0.5 line-clamp-2 text-[14px] font-black leading-[1.15] text-[#111827]">
                        {firstCoupon?.title || "SPECIAL COUPON"}
                      </h3>

                      {firstCoupon?.description && (
                        <p className="mt-1 line-clamp-1 text-[9px] font-semibold text-[#777E88]">
                          {firstCoupon.description}
                        </p>
                      )}
                    </div>

                    <div className="flex min-w-[56px] shrink-0 flex-col items-end justify-center">
                      <span className="text-[9px] font-black text-[#444B55]">
                        {coupons.length} Coupons
                      </span>
                      <span className="mt-1 text-[18px] font-light text-[#B5BAC2]">
                        ›
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <BottomNav />
    </main>
  );
}