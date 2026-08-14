"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

type Coupon = {
  id: string | number;
  business_id: number | null;
  title: string;
  description: string | null;
  active: boolean;
  usage_limit: number | null;
  repeatable?: boolean | null;
  used_count: number | null;
  end_date: string | null;
  image_url: string | null;
};

type Business = {
  id: number;
  name: string | null;
  image_url: string | null;
  image_urls: string[] | null;
};

export default function RedeemCouponPage() {
  const params = useParams();
  const couponId = String(params.id || "");

  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemedAt, setRedeemedAt] = useState<string | null>(null);
  const [redeemAnimationDone, setRedeemAnimationDone] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (couponId) void loadCoupon();
  }, [couponId]);

  useEffect(() => {
    if (!redeemedAt || !coupon?.business_id) return;

    setRedeemAnimationDone(false);

    const animationTimer = window.setTimeout(() => {
      setRedeemAnimationDone(true);
    }, 5400);

    const returnTimer = window.setTimeout(() => {
      window.location.href = `/coupons/business/${coupon.business_id}`;
    }, 9000);

    return () => {
      window.clearTimeout(animationTimer);
      window.clearTimeout(returnTimer);
    };
  }, [redeemedAt, coupon?.business_id]);

  async function loadCoupon() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("coupons")
      .select(
        "id,business_id,title,description,active,usage_limit,repeatable,used_count,end_date,image_url",
      )
      .eq("id", couponId)
      .maybeSingle();

    if (error || !data) {
      setMessage(error?.message || "Coupon not found.");
      setLoading(false);
      return;
    }

    const loaded = data as Coupon;
    setCoupon(loaded);

    if (loaded.business_id) {
      const { data: b } = await supabase
        .from("businesses")
        .select("id,name,image_url,image_urls")
        .eq("id", loaded.business_id)
        .maybeSingle();

      setBusiness((b || null) as Business | null);
    }

    setLoading(false);

    // 쿠폰 사용 가능 상태라면 첫 단계 없이 바로 STAFF ONLY 확인창 표시
    const expired =
      loaded.end_date && new Date(loaded.end_date) < new Date();

    const soldOut =
      loaded.usage_limit &&
      loaded.usage_limit > 0 &&
      (loaded.used_count || 0) >= loaded.usage_limit;

    if (loaded.active && !expired && !soldOut) {
      setShowConfirm(true);
    }
  }

  function unavailableReason() {
    if (!coupon) return "Coupon not found.";

    if (!coupon.active) {
      return "This coupon is no longer active.";
    }

    if (coupon.end_date && new Date(coupon.end_date) < new Date()) {
      return "This coupon has expired.";
    }

    if (
      coupon.usage_limit &&
      coupon.usage_limit > 0 &&
      (coupon.used_count || 0) >= coupon.usage_limit
    ) {
      return "This coupon is no longer available.";
    }

    return "";
  }

  async function redeemCoupon() {
    if (!coupon || redeeming) return;

    const reason = unavailableReason();

    if (reason) {
      setMessage(reason);
      setShowConfirm(false);
      return;
    }

    setRedeeming(true);
    setMessage("");

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("coupons")
      .update({
        used_count: (coupon.used_count || 0) + 1,
        used_at: now,
      })
      .eq("id", coupon.id);

    if (error) {
      setMessage(error.message);
      setRedeeming(false);
      return;
    }

    if (!coupon.repeatable) {
      try {
        window.localStorage.setItem(
          `ktown_coupon_redeemed_${coupon.id}`,
          JSON.stringify({
            couponId: String(coupon.id),
            businessId: coupon.business_id,
            redeemedAt: now,
          }),
        );
      } catch {
        // If browser storage is unavailable, redemption still succeeds in Supabase.
      }
    }

    setRedeemedAt(now);
    setShowConfirm(false);
    setRedeeming(false);
  }

  const image =
    coupon?.image_url ||
    business?.image_url ||
    business?.image_urls?.[0] ||
    "";

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F5F5F5] px-5 py-20 text-center text-sm font-bold text-gray-400">
        Loading coupon...
      </main>
    );
  }

  if (!coupon) {
    return (
      <main className="min-h-screen bg-[#F5F5F5] px-5 py-20 text-center">
        <p className="font-black">
          {message || "Coupon not found."}
        </p>
      </main>
    );
  }

  if (redeemedAt) {
    const date = new Date(redeemedAt);

    return (
      <main className="min-h-screen overflow-hidden bg-[#E94742] px-4 py-8 text-white">
        <style jsx>{`
          @keyframes scissorsTravel {
            0% {
              left: -8%;
              top: 6%;
              transform: rotate(5deg) scale(0.95);
              opacity: 1;
            }
            18% {
              left: 88%;
              top: 6%;
              transform: rotate(8deg) scale(1);
            }
            24% {
              left: 88%;
              top: 44%;
              transform: rotate(95deg) scale(1);
            }
            42% {
              left: 88%;
              top: 87%;
              transform: rotate(95deg) scale(1);
            }
            48% {
              left: 8%;
              top: 87%;
              transform: rotate(185deg) scale(1);
            }
            66% {
              left: -6%;
              top: 87%;
              transform: rotate(185deg) scale(1);
            }
            72% {
              left: -6%;
              top: 45%;
              transform: rotate(275deg) scale(1);
            }
            90% {
              left: -6%;
              top: 6%;
              transform: rotate(275deg) scale(1);
              opacity: 1;
            }
            100% {
              left: -6%;
              top: 6%;
              transform: rotate(275deg) scale(0.9);
              opacity: 0;
            }
          }

          @keyframes dashTop {
            0%, 18% { opacity: 1; }
            24%, 100% { opacity: 0.18; }
          }

          @keyframes dashRight {
            0%, 24% { opacity: 1; }
            42%, 100% { opacity: 0.18; }
          }

          @keyframes dashBottom {
            0%, 48% { opacity: 1; }
            66%, 100% { opacity: 0.18; }
          }

          @keyframes dashLeft {
            0%, 72% { opacity: 1; }
            90%, 100% { opacity: 0.18; }
          }

          @keyframes paperFly {
            0%, 88% {
              transform: translateY(0) rotate(0deg) scale(1);
              opacity: 1;
              filter: blur(0);
            }
            100% {
              transform: translateY(-150px) rotate(-10deg) scale(0.88);
              opacity: 0;
              filter: blur(2px);
            }
          }

          @keyframes revealUsed {
            0% {
              transform: scale(0.94);
              opacity: 0;
            }
            100% {
              transform: scale(1);
              opacity: 1;
            }
          }

          .cut-paper {
            animation: paperFly 5.45s ease-in forwards;
          }

          .scissors {
            animation: scissorsTravel 5s linear forwards;
          }

          .cut-top {
            animation: dashTop 5s linear forwards;
          }

          .cut-right {
            animation: dashRight 5s linear forwards;
          }

          .cut-bottom {
            animation: dashBottom 5s linear forwards;
          }

          .cut-left {
            animation: dashLeft 5s linear forwards;
          }

          .used-reveal {
            animation: revealUsed 0.35s ease-out both;
          }
        `}</style>

        <div className="mx-auto flex min-h-[80vh] max-w-xl flex-col items-center justify-center text-center">
          {!redeemAnimationDone ? (
            <div className="relative w-full max-w-[330px]">
              <div className="cut-paper relative overflow-visible rounded-[24px] bg-white p-5 text-[#171A22] shadow-xl">
                {/* four-sided dotted cut line */}
                <div className="cut-top pointer-events-none absolute left-3 right-3 top-3 border-t-2 border-dashed border-[#E94742]" />
                <div className="cut-right pointer-events-none absolute bottom-3 right-3 top-3 border-r-2 border-dashed border-[#E94742]" />
                <div className="cut-bottom pointer-events-none absolute bottom-3 left-3 right-3 border-b-2 border-dashed border-[#E94742]" />
                <div className="cut-left pointer-events-none absolute bottom-3 left-3 top-3 border-l-2 border-dashed border-[#E94742]" />

                {/* scissors follows the dotted border */}
                <div className="scissors pointer-events-none absolute z-20 text-2xl drop-shadow-sm">
                  ✂️
                </div>

                <div className="overflow-hidden rounded-[16px] bg-[#F3F3F3]">
                  {image ? (
                    <img
                      src={image}
                      alt=""
                      className="h-[155px] w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-[155px] items-center justify-center text-4xl">
                      🎟️
                    </div>
                  )}
                </div>

                <div className="px-2 pb-3 pt-5">
                  {business?.name && (
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#E94742]">
                      {business.name}
                    </p>
                  )}

                  <h1 className="mt-2 text-2xl font-black">
                    {coupon.title}
                  </h1>

                  {coupon.description && (
                    <p className="mt-2 text-sm font-semibold leading-5 text-gray-500">
                      {coupon.description}
                    </p>
                  )}

                  <div className="mt-5 rounded-xl bg-[#FFF4F3] px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#E94742]">
                      Redeeming Coupon
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-gray-500">
                      Cutting along the coupon edge...
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="used-reveal flex w-full flex-col items-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-4xl font-black text-[#E94742]">
                ✓
              </div>

              <p className="mt-6 text-sm font-black uppercase tracking-[0.2em]">
                Coupon Redeemed
              </p>

              <h1 className="mt-3 text-3xl font-black">
                {coupon.title}
              </h1>

              {business?.name && (
                <p className="mt-2 text-base font-bold text-white/85">
                  {business.name}
                </p>
              )}

              <div className="mt-7 rounded-2xl bg-white/15 px-6 py-4">
                <p className="text-xs font-bold uppercase tracking-wider text-white/75">
                  Redeemed at
                </p>

                <p className="mt-1 text-xl font-black">
                  {date.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>

                <p className="mt-1 text-sm font-bold text-white/80">
                  {date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (coupon.business_id) {
                    window.location.href = `/coupons/business/${coupon.business_id}`;
                  } else {
                    window.location.href = "/coupons";
                  }
                }}
                className="mt-7 w-full max-w-[280px] rounded-2xl bg-white px-5 py-4 text-sm font-black text-[#E94742] active:scale-[0.98]"
              >
                BACK TO COUPONS
              </button>

              <p className="mt-3 text-[11px] font-semibold text-white/70">
                Returning to the coupon list automatically...
              </p>
            </div>
          )}
        </div>
      </main>
    );
  }

  const reason = unavailableReason();

  return (
    <main className="min-h-screen bg-[#F5F5F5] px-4 py-5 text-[#171A22]">
      <div className="mx-auto max-w-xl overflow-hidden rounded-[24px] bg-white shadow-sm">
        <div className="relative h-[300px] bg-[#F0F0F0]">
          {image ? (
            <img
              src={image}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-5xl">
              🎟️
            </div>
          )}

          <button
            type="button"
            onClick={() => history.back()}
            className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-2xl shadow"
          >
            ‹
          </button>
        </div>

        <div className="p-5 text-center">
          {business?.name && (
            <p className="text-xs font-black uppercase tracking-wider text-[#E94742]">
              {business.name}
            </p>
          )}

          <h1 className="mt-2 text-2xl font-black">
            {coupon.title}
          </h1>

          {coupon.description && (
            <p className="mt-2 text-sm font-semibold leading-5 text-gray-500">
              {coupon.description}
            </p>
          )}

          {reason && (
            <div className="mt-6 rounded-2xl bg-gray-100 p-4 text-sm font-black text-gray-500">
              {reason}
            </div>
          )}

          {message && (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-600">
              {message}
            </p>
          )}
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-3 pb-3 sm:items-center sm:pb-0">
          <div className="w-full max-w-xl rounded-[26px] bg-white p-5 text-center shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF0EF] text-2xl">
              🎟️
            </div>

            <h2 className="mt-4 text-xl font-black">
              Ready to Redeem?
            </h2>

            <p className="mt-2 text-sm font-semibold leading-5 text-gray-500">
              Please show this screen to a staff member.
            </p>

            <p className="mt-1 text-xs font-semibold text-gray-400">
              Once redeemed, this coupon cannot be used again.
            </p>

            <div className="mt-5 rounded-2xl border-2 border-[#E94742] bg-[#FFF6F5] p-4">
              <p className="text-base font-black tracking-[0.14em] text-[#E94742]">
                STAFF ONLY
              </p>

              <p className="mt-2 text-sm font-bold leading-5 text-[#343942]">
                Please have a staff member tap
                <br />
                REDEEM NOW below.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => history.back()}
                disabled={redeeming}
                className="rounded-2xl border border-gray-200 bg-white px-3 py-4 text-sm font-black text-gray-600 disabled:opacity-50"
              >
                CANCEL
              </button>

              <button
                type="button"
                onClick={redeemCoupon}
                disabled={redeeming}
                className="rounded-2xl bg-[#E94742] px-3 py-4 text-sm font-black text-white active:scale-[0.98] disabled:opacity-50"
              >
                {redeeming
                  ? "REDEEMING..."
                  : "REDEEM NOW"}
              </button>
            </div>

            <p className="mt-4 text-[11px] font-semibold leading-4 text-gray-400">
              Customer: please do not tap REDEEM NOW.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}