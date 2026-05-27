"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

export default function RedeemCouponPage({
  params,
}: {
  params: { id: string };
}) {
  const [message, setMessage] = useState("쿠폰 확인 중...");

  useEffect(() => {
    redeemCoupon();
  }, []);

  async function redeemCoupon() {
    const { data: userCoupon, error } = await supabase
      .from("user_coupons")
      .select(`
        id,
        status,
        coupon_id,
        coupons (
          id,
          title,
          active,
          end_date,
          usage_limit,
          used_count
        )
      `)
      .eq("id", params.id)
      .single();

    if (error || !userCoupon) {
      setMessage("쿠폰을 찾을 수 없습니다.");
      return;
    }

    if (userCoupon.status === "used") {
      setMessage("이미 사용된 쿠폰입니다.");
      return;
    }

    const coupon: any = userCoupon.coupons;

    if (!coupon.active) {
      setMessage("비활성화된 쿠폰입니다.");
      return;
    }

    if (coupon.end_date && new Date(coupon.end_date) < new Date()) {
      setMessage("기간이 만료된 쿠폰입니다.");
      return;
    }

    if (
      coupon.usage_limit > 0 &&
      coupon.used_count >= coupon.usage_limit
    ) {
      setMessage("사용 수량이 모두 끝난 쿠폰입니다.");
      return;
    }

    const { error: updateUserCouponError } = await supabase
      .from("user_coupons")
      .update({
        status: "used",
        used_at: new Date().toISOString(),
      })
      .eq("id", params.id);

    if (updateUserCouponError) {
      setMessage(updateUserCouponError.message);
      return;
    }

    const { error: updateCouponError } = await supabase
      .from("coupons")
      .update({
        used_count: Number(coupon.used_count || 0) + 1,
      })
      .eq("id", coupon.id);

    if (updateCouponError) {
      setMessage(updateCouponError.message);
      return;
    }

    setMessage("쿠폰 사용 완료");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F3EC] p-5 text-[#172033]">
      <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
        <h1 className="text-3xl font-black">
          Coupon Redeem
        </h1>

        <p className="mt-6 text-xl font-bold">
          {message}
        </p>

        <button
          onClick={() => location.href = "/"}
          className="mt-6 rounded-2xl bg-[#172033] px-6 py-3 font-bold text-white"
        >
          Home
        </button>
      </div>
    </main>
  );
}