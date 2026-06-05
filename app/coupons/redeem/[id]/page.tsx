"use client";

import { useState } from "react";
import { supabase } from "../../../../lib/supabase";

export default function RedeemCouponPage({
  params,
}: {
  params: { id: string };
}) {
  const userCouponId = params.id;
  const [pinCode, setPinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function redeemCoupon() {
    if (pinCode.length !== 4) {
      alert("4자리 PIN을 입력하세요.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { data: item, error: loadError } = await supabase
      .from("user_coupons")
      .select(`
        id,
        status,
        used_at,
        coupons (
          id,
          title,
          active,
          pin_code,
          usage_limit,
          used_count,
          end_date
        )
      `)
      .eq("id", userCouponId)
      .maybeSingle();

    if (loadError || !item || !item.coupons) {
      setLoading(false);
      setMessage("쿠폰을 찾을 수 없습니다.");
      return;
    }

    const coupon = Array.isArray(item.coupons)
      ? item.coupons[0]
      : item.coupons;

    if (!coupon) {
      setLoading(false);
      setMessage("쿠폰 정보를 찾을 수 없습니다.");
      return;
    }

    if (item.status !== "claimed") {
      setLoading(false);
      setMessage("이미 사용된 쿠폰입니다.");
      return;
    }

    if (!coupon.active) {
      setLoading(false);
      setMessage("이미 비활성화된 쿠폰입니다.");
      return;
    }

    if (coupon.pin_code !== pinCode) {
      setLoading(false);
      setMessage("PIN 번호가 맞지 않습니다.");
      return;
    }

    if (
      coupon.usage_limit > 0 &&
      coupon.used_count >= coupon.usage_limit
    ) {
      setLoading(false);
      setMessage("이미 사용 한도가 끝난 쿠폰입니다.");
      return;
    }

    if (coupon.end_date && new Date(coupon.end_date) < new Date()) {
      setLoading(false);
      setMessage("기간이 종료된 쿠폰입니다.");
      return;
    }

    const now = new Date().toISOString();

    const { error: userCouponError } = await supabase
      .from("user_coupons")
      .update({
        status: "used",
        used_at: now,
      })
      .eq("id", userCouponId);

    if (userCouponError) {
      setLoading(false);
      setMessage(userCouponError.message);
      return;
    }

    const { error: couponUpdateError } = await supabase
      .from("coupons")
      .update({
        used_count: (coupon.used_count || 0) + 1,
        used_at: now,
      })
      .eq("id", coupon.id);

    if (couponUpdateError) {
      setLoading(false);
      setMessage(couponUpdateError.message);
      return;
    }

    setLoading(false);
    setMessage("✅ 쿠폰이 사용 처리되었습니다.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F3EC] px-5 text-[#172033]">
      <div className="w-full max-w-sm rounded-[28px] bg-white p-6 text-center shadow-2xl">
        <h1 className="text-2xl font-black">Coupon Verification</h1>

        <p className="mt-3 text-sm font-semibold text-gray-500">
          Enter the 4-digit PIN to redeem this coupon.
        </p>

        <input
          type="text"
          inputMode="numeric"
          maxLength={4}
          value={pinCode}
          onChange={(e) =>
            setPinCode(e.target.value.replace(/\D/g, "").slice(0, 4))
          }
          placeholder="1234"
          className="mt-6 w-full rounded-2xl border bg-gray-50 p-4 text-center text-3xl font-black tracking-[0.5em] outline-none focus:border-[#172033]"
        />

        <button
          type="button"
          onClick={redeemCoupon}
          disabled={loading}
          className="mt-5 w-full rounded-2xl bg-[#172033] p-4 text-lg font-black text-white active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? "Checking..." : "Use Coupon"}
        </button>

        {message && (
          <p className="mt-5 rounded-2xl bg-gray-100 p-4 text-sm font-bold">
            {message}
          </p>
        )}

        <button
          type="button"
          onClick={() => {
            window.location.href = "/";
          }}
          className="mt-5 text-sm font-bold text-gray-400"
        >
          Back to Home
        </button>
      </div>
    </main>
  );
}