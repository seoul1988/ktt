"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

type Business = {
  id: number;
  name: string | null;
  category: string | null;
  address: string | null;
  phone: string | null;
  image_url: string | null;
  image_urls: string[] | null;
};

type Coupon = {
  id: string | number;
  business_id: number;
  title: string;
  description: string | null;
  coupon_type: string | null;
  value: number | null;
  start_date: string | null;
  end_date: string | null;
  usage_limit: number | null;
  used_count: number | null;
  active: boolean | null;
  image_url: string | null;
};

type RedeemedInfo = {
  redeemedAt: string;
};

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}


function formatUsedDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "USED";

  return `Used ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} · ${date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export default function BusinessCouponsPage() {
  const params = useParams();
  const businessId = Number(params.id);

  const [business, setBusiness] = useState<Business | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [redeemedMap, setRedeemedMap] = useState<Record<string, RedeemedInfo>>({});

  useEffect(() => {
    if (Number.isFinite(businessId) && businessId > 0) {
      void loadData();
    } else {
      setLoading(false);
      setErrorText("Invalid business ID.");
    }
  }, [businessId]);

  function loadRedeemedFromThisDevice(couponRows: Coupon[]) {
    const next: Record<string, RedeemedInfo> = {};

    for (const coupon of couponRows) {
      try {
        const raw = window.localStorage.getItem(
          `ktown_coupon_redeemed_${coupon.id}`,
        );

        if (!raw) continue;

        const parsed = JSON.parse(raw) as {
          redeemedAt?: string;
        };

        if (parsed.redeemedAt) {
          next[String(coupon.id)] = {
            redeemedAt: parsed.redeemedAt,
          };
        }
      } catch {
        // Ignore invalid or unavailable browser storage.
      }
    }

    setRedeemedMap(next);
  }

  async function loadData() {
    setLoading(true);
    setErrorText("");

    const businessResult = await supabase
      .from("businesses")
      .select("id,name,category,address,phone,image_url,image_urls")
      .eq("id", businessId)
      .maybeSingle();

    if (businessResult.error) {
      setErrorText(`Business load error: ${businessResult.error.message}`);
      setLoading(false);
      return;
    }

    setBusiness((businessResult.data || null) as Business | null);

    const couponResult = await supabase
      .from("coupons")
      .select(
        "id,business_id,title,description,coupon_type,value,start_date,end_date,usage_limit,used_count,active,image_url",
      )
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (couponResult.error) {
      setErrorText(`Coupon load error: ${couponResult.error.message}`);
      setLoading(false);
      return;
    }

    const couponRows = (couponResult.data || []) as Coupon[];
    setCoupons(couponRows);
    loadRedeemedFromThisDevice(couponRows);
    setLoading(false);
  }

  const heroImage = useMemo(() => {
    return (
      coupons.find((c) => c.image_url)?.image_url ||
      business?.image_url ||
      business?.image_urls?.[0] ||
      ""
    );
  }, [business, coupons]);

  const orderedCoupons = useMemo(() => {
    return [...coupons].sort((a, b) => {
      const aUsed = Boolean(redeemedMap[String(a.id)]);
      const bUsed = Boolean(redeemedMap[String(b.id)]);

      if (aUsed === bUsed) return 0;
      return aUsed ? 1 : -1;
    });
  }, [coupons, redeemedMap]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F5F5F5]">
        <div className="mx-auto min-h-screen max-w-[430px] bg-white px-4 py-20 text-center text-sm font-bold text-gray-400">
          Loading coupons...
        </div>
      </main>
    );
  }

  if (!business) {
    return (
      <main className="min-h-screen bg-[#F5F5F5]">
        <div className="mx-auto min-h-screen max-w-[430px] bg-white px-4 py-20 text-center">
          <p className="font-black">Business not found.</p>
          {errorText && (
            <p className="mt-2 text-xs font-semibold text-red-500">{errorText}</p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F5F5] text-[#171A22]">
      <div className="mx-auto min-h-screen max-w-[430px] bg-white pb-8">
        <div className="relative h-[210px] overflow-hidden bg-[#EEE]">
          {heroImage ? (
            <img
              src={heroImage}
              alt={business.name || ""}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-5xl">
              🏪
            </div>
          )}

          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
            <button
              type="button"
              onClick={() => history.back()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-2xl shadow"
            >
              ‹
            </button>

            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-xl shadow"
            >
              ♡
            </button>
          </div>
        </div>

        <section className="relative px-4 pb-3 pt-4">
          <div className="absolute -top-8 left-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-white shadow">
            {business.image_url ? (
              <img
                src={business.image_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-2xl">🏪</span>
            )}
          </div>

          <div className="pl-[76px]">
            <h1 className="text-[21px] font-black leading-tight">
              {business.name}
            </h1>
            <p className="mt-1 text-[11px] font-semibold text-gray-500">
              {business.category || "Local Business"}
            </p>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-[#F8F8F8] px-3 py-2">
            <div className="min-w-0">
              {business.address && (
                <p className="truncate text-[10px] font-semibold text-gray-500">
                  {business.address}
                </p>
              )}
              {business.phone && (
                <p className="mt-0.5 text-[10px] font-bold text-gray-400">
                  {business.phone}
                </p>
              )}
            </div>

            <span className="ml-3 shrink-0 rounded-full bg-[#FFF0EF] px-3 py-1 text-[10px] font-black text-[#E74742]">
              {coupons.length} Coupons
            </span>
          </div>
        </section>

        <section className="px-3 py-3">
          {errorText && (
            <div className="mb-3 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-600">
              {errorText}
            </div>
          )}

          {coupons.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-5xl">🎟️</div>
              <p className="mt-4 text-[16px] font-black">
                No coupons available.
              </p>
              <p className="mt-2 text-xs font-semibold text-gray-400">
                Business ID: {businessId}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {orderedCoupons.map((coupon) => {
                const expired =
                  coupon.end_date &&
                  new Date(coupon.end_date) < new Date();

                const soldOut =
                  coupon.usage_limit &&
                  coupon.usage_limit > 0 &&
                  (coupon.used_count || 0) >= coupon.usage_limit;

                const disabled = coupon.active === false || expired || soldOut;
                const redeemedInfo = redeemedMap[String(coupon.id)];
                const usedOnThisDevice = Boolean(redeemedInfo);

                return (
                  <article
                    key={coupon.id}
                    className={`flex items-center gap-3 rounded-[13px] border p-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] ${
                      usedOnThisDevice
                        ? "border-[#E5E7EB] bg-[#F7F7F7] opacity-70"
                        : "border-[#ECECEC] bg-white"
                    }`}
                  >
                    <div className="h-[62px] w-[62px] shrink-0 overflow-hidden rounded-[10px] bg-[#F2F2F2]">
                      {coupon.image_url ? (
                        <img
                          src={coupon.image_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : business.image_url ? (
                        <img
                          src={business.image_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xl">
                          🎟️
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h2 className="line-clamp-2 text-[13px] font-black leading-[1.15]">
                        {coupon.title}
                      </h2>

                      {coupon.description && (
                        <p className="mt-1 line-clamp-2 text-[9px] font-semibold leading-[1.3] text-[#777E88]">
                          {coupon.description}
                        </p>
                      )}

                      {usedOnThisDevice && redeemedInfo ? (
                        <p className="mt-1.5 text-[9px] font-black text-[#6B7280]">
                          {formatUsedDateTime(redeemedInfo.redeemedAt)}
                        </p>
                      ) : coupon.end_date ? (
                        <p className="mt-1.5 text-[8px] font-bold text-[#9BA1AA]">
                          Exp. {formatDate(coupon.end_date)}
                        </p>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      disabled={Boolean(disabled || usedOnThisDevice)}
                      onClick={() => {
                        window.location.href = `/coupons/redeem/${coupon.id}`;
                      }}
                      className={`shrink-0 rounded-[8px] px-3 py-2 text-[9px] font-black ${
                        usedOnThisDevice
                          ? "border border-[#D1D5DB] bg-[#E5E7EB] text-[#6B7280]"
                          : disabled
                            ? "bg-gray-300 text-white"
                            : "bg-[#EB4A45] text-white active:scale-[0.98]"
                      }`}
                    >
                      {usedOnThisDevice
                        ? "✓ USED"
                        : disabled
                          ? "UNAVAILABLE"
                          : "USE"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}