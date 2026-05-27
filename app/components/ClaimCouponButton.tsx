"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function ClaimCouponButton({
  couponId,
}: {
  couponId:number;
}) {

  const [loading,setLoading]=useState(false);

  async function claim() {

    setLoading(true);

    const {
      data:{user},
    } =
      await supabase.auth.getUser();

    if (!user) {
      location.href="/login";
      return;
    }

    const { error } =
      await supabase
      .from("user_coupons")
      .insert({
        user_id:user.id,
        coupon_id:couponId,
      });

    setLoading(false);

    if (error) {
      alert("이미 받은 쿠폰");
      return;
    }

    alert("쿠폰 저장 완료");
  }

  return (
    <button
      onClick={claim}
      disabled={loading}
      className="
        mt-3
        rounded-lg
        bg-red-500
        px-4
        py-2
        text-white
      "
    >
      받기
    </button>
  );
}