"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import ProfileButton from "../components/ProfileButton";
import BottomNav from "../components/BottomNav";

type Business = {
  id: number;
  name: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
};

type Coupon = {
  id: number;
  business_id: number;
  title: string;
  description: string | null;
  end_date: string | null;
  active: boolean | null;
  activation_mode?: string | null;
  promo_code?: string | null;
  order_url?: string | null;
  order_button_text?: string | null;
  image_url?: string | null;
  businesses?: Business | Business[] | null;
};

type StampedInfo = {
  stampedAt: string;
  expiresAt: string;
};

type RedeemedInfo = {
  redeemedAt: string;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function businessOf(coupon: Coupon) {
  if (Array.isArray(coupon.businesses)) {
    return coupon.businesses[0] || null;
  }

  return coupon.businesses || null;
}

function reservationUsedKey(couponId: string | number) {
  return `ktown_coupon_reservation_used_${couponId}`;
}

export default function MyCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [favoriteBusinessIds, setFavoriteBusinessIds] = useState<number[]>([]);
  const [stampedMap, setStampedMap] = useState<Record<string, StampedInfo>>({});
  const [redeemedMap, setRedeemedMap] = useState<Record<string, RedeemedInfo>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"saved" | "stamped" | "used">("saved");

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data, error } = await supabase
      .from("coupons")
      .select(`
        id,
        business_id,
        title,
        description,
        end_date,
        active,
        activation_mode,
        promo_code,
        order_url,
        order_button_text,
        image_url,
        businesses (
          id,
          name,
          image_url,
          image_urls
        )
      `)
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const rows = (data || []) as Coupon[];
    setCoupons(rows);

    try {
      const raw = window.localStorage.getItem("ktown_coupon_favorite_businesses");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setFavoriteBusinessIds(
            parsed
              .map((value) => Number(value))
              .filter((value) => Number.isFinite(value)),
          );
        }
      }
    } catch {
      // ignore invalid storage
    }

    const stampedNext: Record<string, StampedInfo> = {};
    const redeemedNext: Record<string, RedeemedInfo> = {};
    const now = Date.now();

    for (const coupon of rows) {
      try {
        const stampedRaw = window.localStorage.getItem(
          `ktown_coupon_stamped_${coupon.id}`,
        );

        if (stampedRaw) {
          const parsed = JSON.parse(stampedRaw) as Partial<StampedInfo>;
          const expiresAtMs = parsed.expiresAt
            ? new Date(parsed.expiresAt).getTime()
            : NaN;

          if (
            parsed.stampedAt &&
            parsed.expiresAt &&
            Number.isFinite(expiresAtMs) &&
            expiresAtMs >= now
          ) {
            stampedNext[String(coupon.id)] = {
              stampedAt: parsed.stampedAt,
              expiresAt: parsed.expiresAt,
            };
          }
        }
      } catch {
        // ignore invalid storage
      }

      try {
        const currentYear = new Date().getFullYear();

        // Reservation coupons are saved with a dedicated USED key.
        // Also check the normal and yearly redemption keys so My Coupons
        // matches the business coupon page and the redeem page.
        const keysToCheck = [
          reservationUsedKey(coupon.id),
          `ktown_coupon_redeemed_${coupon.id}`,
          `ktown_coupon_redeemed_${coupon.id}_${currentYear}`,
        ];

        let redeemedRaw: string | null = null;

        for (const key of keysToCheck) {
          redeemedRaw = window.localStorage.getItem(key);
          if (redeemedRaw) break;
        }

        if (redeemedRaw) {
          const parsed = JSON.parse(redeemedRaw) as Partial<RedeemedInfo>;
          if (parsed.redeemedAt) {
            redeemedNext[String(coupon.id)] = {
              redeemedAt: parsed.redeemedAt,
            };
          }
        }
      } catch {
        // ignore invalid storage
      }
    }

    setStampedMap(stampedNext);
    setRedeemedMap(redeemedNext);
    setLoading(false);
  }

  const savedCoupons = useMemo(() => {
    return coupons.filter((coupon) =>
      favoriteBusinessIds.includes(Number(coupon.business_id)),
    );
  }, [coupons, favoriteBusinessIds]);

  const stampedCoupons = useMemo(() => {
    return coupons.filter(
      (coupon) =>
        Boolean(stampedMap[String(coupon.id)]) &&
        !Boolean(redeemedMap[String(coupon.id)]),
    );
  }, [coupons, stampedMap, redeemedMap]);

  const usedCoupons = useMemo(() => {
    return coupons.filter((coupon) =>
      Boolean(redeemedMap[String(coupon.id)]),
    );
  }, [coupons, redeemedMap]);

  const currentItems =
    activeTab === "saved"
      ? savedCoupons
      : activeTab === "stamped"
        ? stampedCoupons
        : usedCoupons;

  function openCoupon(coupon: Coupon) {
    if (coupon.activation_mode === "online_order") {
      const raw = String(coupon.order_url || "").trim();
      if (!raw) return;

      const code = String(coupon.promo_code || "").trim();

      if (code && navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(code).catch(() => {
          // 주문 페이지 이동은 계속 진행
        });
      }

      const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      window.location.href = url;
      return;
    }

    window.location.href = `/coupons/business/${coupon.business_id}`;
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] pb-28 text-[#172033]">
      <div className="mx-auto min-h-screen w-full max-w-xl bg-[#F8F3EC]">
        <div className="sticky top-0 z-30 border-b border-[#E9DFD4] bg-[#F8F3EC]/95 px-4 pb-3 pt-4 backdrop-blur">
          <div className="relative flex h-11 items-center">
            <button
              type="button"
              onClick={() => {
                window.location.href = "/";
              }}
              className="rounded-full bg-white px-4 py-2 text-sm font-black shadow-sm"
            >
              ← Back
            </button>

            <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-[28px] font-black">
              My Coupons
            </h1>

            <div className="ml-auto">
              <ProfileButton />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 rounded-2xl bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setActiveTab("saved")}
              className={`rounded-xl px-2 py-2.5 text-xs font-black ${
                activeTab === "saved"
                  ? "bg-[#EB4A45] text-white"
                  : "text-[#646B76]"
              }`}
            >
              ♥ Saved {savedCoupons.length}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("stamped")}
              className={`rounded-xl px-2 py-2.5 text-xs font-black ${
                activeTab === "stamped"
                  ? "bg-[#EB4A45] text-white"
                  : "text-[#646B76]"
              }`}
            >
              ✓ Stamped {stampedCoupons.length}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("used")}
              className={`rounded-xl px-2 py-2.5 text-xs font-black ${
                activeTab === "used"
                  ? "bg-[#EB4A45] text-white"
                  : "text-[#646B76]"
              }`}
            >
              Used {usedCoupons.length}
            </button>
          </div>
        </div>

        <section className="px-4 py-4">
          {loading ? (
            <div className="rounded-3xl bg-white p-8 text-center text-sm font-bold text-gray-400 shadow-sm">
              Loading coupons...
            </div>
          ) : currentItems.length === 0 ? (
            <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
              <div className="text-5xl">
                {activeTab === "saved" ? "♡" : activeTab === "stamped" ? "✓" : "🎟️"}
              </div>

              <p className="mt-4 text-lg font-black">
                {activeTab === "saved"
                  ? "No saved coupons yet."
                  : activeTab === "stamped"
                    ? "No stamped coupons yet."
                    : "No used coupons yet."}
              </p>

              <p className="mt-2 text-sm font-semibold text-gray-500">
                {activeTab === "saved"
                  ? "Tap the heart on a store in Coupon Book to save it."
                  : activeTab === "stamped"
                    ? "First-visit coupons will appear here after staff stamps them."
                    : "Redeemed coupons will appear here."}
              </p>

              {activeTab === "saved" && (
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = "/coupons";
                  }}
                  className="mt-5 rounded-2xl bg-[#EB4A45] px-5 py-3 text-sm font-black text-white"
                >
                  OPEN COUPON BOOK
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {currentItems.map((coupon) => {
                const business = businessOf(coupon);
                const stampedInfo = stampedMap[String(coupon.id)];
                const redeemedInfo = redeemedMap[String(coupon.id)];
                const image =
                  coupon.image_url ||
                  business?.image_url ||
                  business?.image_urls?.[0] ||
                  "";

                const isOnline = coupon.activation_mode === "online_order";

                return (
                  <article
                    key={`${activeTab}-${coupon.id}`}
                    className={`overflow-hidden rounded-3xl border bg-white shadow-sm ${
                      redeemedInfo
                        ? "border-[#E5E7EB] opacity-70"
                        : "border-[#ECE5DD]"
                    }`}
                  >
                    <div className="flex gap-3 p-3">
                      <div className="h-[82px] w-[92px] shrink-0 overflow-hidden rounded-2xl bg-[#F1F1F1]">
                        {image ? (
                          <img
                            src={image}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-3xl">
                            🎟️
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[10px] font-black uppercase text-[#7A808A]">
                          {business?.name || "Local Business"}
                        </p>

                        <h2 className="mt-0.5 line-clamp-2 text-[16px] font-black leading-tight">
                          {coupon.title}
                        </h2>

                        {coupon.description && (
                          <p className="mt-1 line-clamp-2 text-[10px] font-semibold leading-4 text-[#747B85]">
                            {coupon.description}
                          </p>
                        )}

                        {redeemedInfo ? (
                          <p className="mt-2 text-[10px] font-black text-gray-500">
                            ✓ USED · {formatDate(redeemedInfo.redeemedAt)}
                          </p>
                        ) : stampedInfo ? (
                          <p className="mt-2 text-[10px] font-black text-green-700">
                            ✓ STAMPED · Use by {formatDate(stampedInfo.expiresAt)}
                          </p>
                        ) : isOnline ? (
                          <p className="mt-2 text-[10px] font-black text-blue-600">
                            ONLINE ORDER
                            {coupon.promo_code ? ` · CODE ${coupon.promo_code}` : ""}
                          </p>
                        ) : coupon.end_date ? (
                          <p className="mt-2 text-[10px] font-bold text-gray-400">
                            Exp. {formatDate(coupon.end_date)}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="border-t border-[#F0ECE7] p-3">
                      {redeemedInfo ? (
                        <div className="rounded-2xl bg-[#F3F4F6] py-3 text-center text-xs font-black text-[#737983]">
                          USED
                        </div>
                      ) : isOnline ? (
                        <button
                          type="button"
                          disabled={!coupon.order_url}
                          onClick={() => openCoupon(coupon)}
                          className={`w-full rounded-2xl py-3 text-xs font-black ${
                            coupon.order_url
                              ? "bg-[#EB4A45] text-white active:scale-[0.99]"
                              : "bg-gray-200 text-gray-400"
                          }`}
                        >
                          🛒 {coupon.order_button_text || "ORDER NOW"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openCoupon(coupon)}
                          className="w-full rounded-2xl bg-[#EB4A45] py-3 text-xs font-black text-white active:scale-[0.99]"
                        >
                          {stampedInfo ? "USE COUPON" : "VIEW COUPON"}
                        </button>
                      )}
                    </div>
                  </article>
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