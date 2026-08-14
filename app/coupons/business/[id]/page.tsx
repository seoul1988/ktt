"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import BottomNav from "../../../components/BottomNav";

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
  activation_mode?: string | null;
  stamp_valid_days?: number | null;
  stamp_code?: string | null;
  stamp_text?: string | null;
  info_text?: string | null;
  promo_code?: string | null;
  order_url?: string | null;
  order_button_text?: string | null;
  image_url: string | null;
};

type RedeemedInfo = {
  redeemedAt: string;
};

type StampedInfo = {
  stampedAt: string;
  expiresAt: string;
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
  const [stampedMap, setStampedMap] = useState<Record<string, StampedInfo>>({});
  const [codeCoupon, setCodeCoupon] = useState<Coupon | null>(null);
  const [storeCode, setStoreCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [infoCouponId, setInfoCouponId] = useState<string | null>(null);
  const [copiedCouponId, setCopiedCouponId] = useState<string | null>(null);

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

  function loadStampedFromThisDevice(couponRows: Coupon[]) {
    const next: Record<string, StampedInfo> = {};
    const now = Date.now();

    for (const coupon of couponRows) {
      try {
        const raw = window.localStorage.getItem(
          `ktown_coupon_stamped_${coupon.id}`,
        );

        if (!raw) continue;

        const parsed = JSON.parse(raw) as {
          stampedAt?: string;
          expiresAt?: string;
        };

        if (!parsed.stampedAt || !parsed.expiresAt) continue;

        const expiresAtMs = new Date(parsed.expiresAt).getTime();
        if (!Number.isFinite(expiresAtMs) || expiresAtMs < now) {
          window.localStorage.removeItem(`ktown_coupon_stamped_${coupon.id}`);
          continue;
        }

        next[String(coupon.id)] = {
          stampedAt: parsed.stampedAt,
          expiresAt: parsed.expiresAt,
        };
      } catch {
        // Ignore invalid or unavailable browser storage.
      }
    }

    setStampedMap(next);
  }

  function openStoreCode(coupon: Coupon) {
    setCodeCoupon(coupon);
    setStoreCode("");
    setCodeError("");
  }

  function closeStoreCode() {
    setCodeCoupon(null);
    setStoreCode("");
    setCodeError("");
  }

  function submitStoreCode() {
    if (!codeCoupon) return;

    const expectedCode = String(codeCoupon.stamp_code || "").trim();
    const enteredCode = storeCode.trim();

    if (!expectedCode || expectedCode.length !== 4) {
      setCodeError("Store code is not configured. Please ask the business.");
      return;
    }

    if (enteredCode !== expectedCode) {
      setCodeError("Incorrect store code.");
      return;
    }

    const stampedAt = new Date();
    const validDays = Math.max(1, Number(codeCoupon.stamp_valid_days || 31));
    const expiresAt = new Date(
      stampedAt.getTime() + validDays * 24 * 60 * 60 * 1000,
    );

    const info: StampedInfo = {
      stampedAt: stampedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    try {
      window.localStorage.setItem(
        `ktown_coupon_stamped_${codeCoupon.id}`,
        JSON.stringify(info),
      );
    } catch {
      // If storage is unavailable, still update the current screen.
    }

    setStampedMap((prev) => ({
      ...prev,
      [String(codeCoupon.id)]: info,
    }));

    closeStoreCode();
  }

  async function copyPromoCode(coupon: Coupon) {
    const code = String(coupon.promo_code || "").trim();
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = code;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }

    setCopiedCouponId(String(coupon.id));
    window.setTimeout(() => {
      setCopiedCouponId((current) =>
        current === String(coupon.id) ? null : current,
      );
    }, 1800);
  }

  function openOrderPage(coupon: Coupon) {
    const raw = String(coupon.order_url || "").trim();
    if (!raw) return;

    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    window.open(url, "_blank", "noopener,noreferrer");
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
        "id,business_id,title,description,coupon_type,value,start_date,end_date,usage_limit,used_count,active,activation_mode,stamp_valid_days,stamp_code,stamp_text,info_text,promo_code,order_url,order_button_text,image_url",
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
    loadStampedFromThisDevice(couponRows);
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
        <div className="mx-auto min-h-screen max-w-xl bg-white px-4 py-20 text-center text-sm font-bold text-gray-400">
          Loading coupons...
        </div>
      </main>
    );
  }

  if (!business) {
    return (
      <main className="min-h-screen bg-[#F5F5F5]">
        <div className="mx-auto min-h-screen max-w-xl bg-white px-4 py-20 text-center">
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
      <div className="mx-auto min-h-screen max-w-xl bg-white pb-24">
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
                const stampedInfo = stampedMap[String(coupon.id)];
                const isStaffStamp =
                  coupon.activation_mode === "staff_stamp";
                const isOnlineOrder =
                  coupon.activation_mode === "online_order";
                const isStamped = Boolean(stampedInfo);

                return (
                  <article
                    key={coupon.id}
                    className={`flex items-center gap-3 rounded-[13px] border p-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] ${
                      usedOnThisDevice
                        ? "border-[#E5E7EB] bg-[#F7F7F7] opacity-70"
                        : "border-[#ECECEC] bg-white"
                    }`}
                  >
                    <div className="relative h-[62px] w-[62px] shrink-0 overflow-hidden rounded-[10px] bg-[#F2F2F2]">
                      {coupon.image_url ? (
                        <img
                          src={coupon.image_url}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover object-center"
                          style={{
                            width: "130%",
                            height: "130%",
                            maxWidth: "none",
                            left: "-15%",
                            top: "-15%",
                          }}
                        />
                      ) : business.image_url ? (
                        <img
                          src={business.image_url}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover object-center"
                          style={{
                            width: "130%",
                            height: "130%",
                            maxWidth: "none",
                            left: "-15%",
                            top: "-15%",
                          }}
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
                      ) : isStaffStamp && isStamped && stampedInfo ? (
                        <p className="mt-1.5 text-[9px] font-black text-green-700">
                          ✓ STAMPED · Use by {formatDate(stampedInfo.expiresAt)}
                        </p>
                      ) : isStaffStamp ? (
                        <p className="mt-1.5 text-[8px] font-bold text-[#E74742]">
                          Store code required
                        </p>
                      ) : isOnlineOrder ? (
                        <p className="mt-1.5 text-[9px] font-black text-blue-600">
                          Online order promo code
                        </p>
                      ) : coupon.end_date ? (
                        <p className="mt-1.5 text-[8px] font-bold text-[#9BA1AA]">
                          Exp. {formatDate(coupon.end_date)}
                        </p>
                      ) : null}
                    </div>

                    {isOnlineOrder ? (
                      <div className="flex shrink-0 flex-col items-stretch gap-1.5">
                        <button
                          type="button"
                          onClick={() => void copyPromoCode(coupon)}
                          className="rounded-[9px] border border-blue-200 bg-blue-50 px-3 py-2 text-[9px] font-black text-blue-700 active:scale-[0.98]"
                        >
                          {copiedCouponId === String(coupon.id)
                            ? "✓ COPIED"
                            : coupon.promo_code
                              ? `COPY ${coupon.promo_code}`
                              : "COPY CODE"}
                        </button>

                        <button
                          type="button"
                          disabled={!coupon.order_url}
                          onClick={() => openOrderPage(coupon)}
                          className={`rounded-[9px] px-3 py-2 text-[9px] font-black ${
                            coupon.order_url
                              ? "bg-[#EB4A45] text-white active:scale-[0.98]"
                              : "bg-gray-200 text-gray-400"
                          }`}
                        >
                          {coupon.order_button_text || "ORDER NOW"}
                        </button>
                      </div>
                    ) : (
                    <div className="relative flex shrink-0 flex-col items-end gap-1">
                      {isStaffStamp && !usedOnThisDevice && !isStamped && (
                        <button
                          type="button"
                          onClick={() => openStoreCode(coupon)}
                          className="animate-pulse rounded-full bg-amber-100 px-2 py-1 text-[8px] font-black uppercase tracking-wide text-amber-700 ring-1 ring-amber-300"
                        >
                          ⚠ FIRST VISIT
                        </button>
                      )}

                      <div className="relative flex items-center gap-1.5">
                        {isStaffStamp && !usedOnThisDevice && (
                          <button
                            type="button"
                            aria-label="Coupon information"
                            onClick={(event) => {
                              event.stopPropagation();
                              setInfoCouponId((prev) =>
                                prev === String(coupon.id) ? null : String(coupon.id),
                              );
                            }}
                            className="animate-pulse text-[18px] font-black leading-none text-amber-500"
                          >
                            ⓘ
                          </button>
                        )}

                        {isStaffStamp && infoCouponId === String(coupon.id) && (
                        <div className="absolute bottom-full right-0 z-40 mb-2 w-[220px] rounded-2xl border border-amber-200 bg-white p-3 text-left shadow-xl">
                          <div className="absolute -bottom-1.5 right-4 h-3 w-3 rotate-45 border-b border-r border-amber-200 bg-white" />
                          <p className="text-[10px] font-black uppercase tracking-wide text-amber-600">
                            First Visit
                          </p>
                          <p className="mt-1 text-[11px] font-bold leading-[1.45] text-gray-700">
                            {coupon.info_text ||
                              "First visit? Ask a staff member to stamp this coupon."}
                          </p>
                        </div>
                      )}

                        <button
                          type="button"
                          disabled={Boolean(disabled || usedOnThisDevice)}
                          onClick={() => {
                            if (isStaffStamp && !isStamped) {
                              openStoreCode(coupon);
                              return;
                            }

                            window.location.href = `/coupons/redeem/${coupon.id}`;
                          }}
                          className={`rounded-[10px] px-3.5 py-2.5 text-[9px] font-black shadow-sm ${
                            usedOnThisDevice
                              ? "border border-[#D1D5DB] bg-[#E5E7EB] text-[#6B7280]"
                              : disabled
                                ? "bg-gray-300 text-white"
                                : isStaffStamp && isStamped
                                  ? "bg-green-600 text-white active:scale-[0.98]"
                                  : isStaffStamp
                                    ? "animate-pulse bg-[#EB4A45] text-white ring-2 ring-red-200 active:scale-[0.98]"
                                    : "bg-[#EB4A45] text-white active:scale-[0.98]"
                          }`}
                        >
                          {usedOnThisDevice
                            ? "✓ USED"
                            : disabled
                              ? "UNAVAILABLE"
                              : isStaffStamp && isStamped
                                ? "USE"
                                : isStaffStamp
                                  ? "GET STAFF STAMP"
                                  : "USE"}
                        </button>
                      </div>
                    </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {codeCoupon && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 px-5"
          onClick={closeStoreCode}
        >
          <div
            className="w-full max-w-sm rounded-[24px] bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF0EF] text-2xl">
                🔐
              </div>
              <p className="mt-3 text-[11px] font-black uppercase tracking-[0.18em] text-[#E74742]">
                Staff Verification
              </p>
              <h2 className="mt-1 text-xl font-black">
                Enter Store Code
              </h2>
              <p className="mt-2 text-xs font-semibold leading-5 text-gray-500">
                Please ask a staff member to enter the 4-digit store code.
              </p>
            </div>

            <input
              autoFocus
              value={storeCode}
              inputMode="numeric"
              maxLength={4}
              onChange={(event) => {
                setStoreCode(
                  event.target.value.replace(/\D/g, "").slice(0, 4),
                );
                setCodeError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && storeCode.length === 4) {
                  submitStoreCode();
                }
              }}
              placeholder="••••"
              className="mt-5 w-full rounded-2xl border-2 border-[#E5E7EB] bg-[#FAFAFA] px-4 py-4 text-center text-3xl font-black tracking-[0.45em] outline-none focus:border-[#EB4A45]"
            />

            {codeError && (
              <p className="mt-2 text-center text-xs font-black text-red-600">
                {codeError}
              </p>
            )}

            <button
              type="button"
              disabled={storeCode.length !== 4}
              onClick={submitStoreCode}
              className={`mt-4 w-full rounded-2xl py-3.5 text-sm font-black ${
                storeCode.length === 4
                  ? "bg-[#EB4A45] text-white active:scale-[0.99]"
                  : "bg-gray-200 text-gray-400"
              }`}
            >
              VERIFY & STAMP
            </button>

            <button
              type="button"
              onClick={closeStoreCode}
              className="mt-2 w-full rounded-2xl py-3 text-xs font-black text-gray-500"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  );
}