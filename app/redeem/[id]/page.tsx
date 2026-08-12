"use client";

import { use, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

type Coupon = {
  id: number;
  title: string | null;
  active: boolean | null;
  end_date: string | null;
  usage_limit: number | null;
  used_count: number | null;
};

type UserCoupon = {
  id: string;
  status: string | null;
  coupon_id: number | null;
  coupons: Coupon | Coupon[] | null;
};

export default function RedeemCouponPage({
  params,
}: Props) {
  const { id } = use(params);

  const [message, setMessage] =
    useState("쿠폰 확인 중...");

  useEffect(() => {
    void redeemCoupon();
  }, [id]);

  async function redeemCoupon() {
    try {
      setMessage("쿠폰 확인 중...");

      const {
        data: userCouponData,
        error,
      } = await supabase
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
        .eq("id", id)
        .single();

      if (error || !userCouponData) {
        console.error(
          "Failed to load coupon:",
          error,
        );

        setMessage(
          "쿠폰을 찾을 수 없습니다.",
        );
        return;
      }

      const userCoupon =
        userCouponData as UserCoupon;

      if (userCoupon.status === "used") {
        setMessage(
          "이미 사용된 쿠폰입니다.",
        );
        return;
      }

      const coupon = Array.isArray(
        userCoupon.coupons,
      )
        ? userCoupon.coupons[0]
        : userCoupon.coupons;

      if (!coupon) {
        setMessage(
          "쿠폰 정보를 찾을 수 없습니다.",
        );
        return;
      }

      if (coupon.active !== true) {
        setMessage(
          "비활성화된 쿠폰입니다.",
        );
        return;
      }

      if (
        coupon.end_date &&
        new Date(coupon.end_date).getTime() <
          Date.now()
      ) {
        setMessage(
          "기간이 만료된 쿠폰입니다.",
        );
        return;
      }

      const usageLimit =
        Number(coupon.usage_limit || 0);

      const usedCount =
        Number(coupon.used_count || 0);

      if (
        usageLimit > 0 &&
        usedCount >= usageLimit
      ) {
        setMessage(
          "사용 수량이 모두 끝난 쿠폰입니다.",
        );
        return;
      }

      const {
        error: updateUserCouponError,
      } = await supabase
        .from("user_coupons")
        .update({
          status: "used",
          used_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateUserCouponError) {
        console.error(
          "Failed to redeem user coupon:",
          updateUserCouponError,
        );

        setMessage(
          updateUserCouponError.message,
        );
        return;
      }

      const {
        error: updateCouponError,
      } = await supabase
        .from("coupons")
        .update({
          used_count: usedCount + 1,
        })
        .eq("id", coupon.id);

      if (updateCouponError) {
        console.error(
          "Failed to update coupon count:",
          updateCouponError,
        );

        setMessage(
          updateCouponError.message,
        );
        return;
      }

      setMessage("쿠폰 사용 완료");
    } catch (error) {
      console.error(
        "Coupon redeem error:",
        error,
      );

      setMessage(
        "쿠폰 처리 중 오류가 발생했습니다.",
      );
    }
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
          type="button"
          onClick={() => {
            window.location.href = "/";
          }}
          className="mt-6 rounded-2xl bg-[#172033] px-6 py-3 font-bold text-white"
        >
          Home
        </button>
      </div>
    </main>
  );
}