"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function ClaimCouponButton({
  couponId,
}: {
  couponId: number;
}) {
  const [loading, setLoading] = useState(false);

  async function claim() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      location.href = "/login";
      return;
    }

    const { data: existing, error: existingError } = await supabase
      .from("user_coupons")
      .select("id,status")
      .eq("user_id", user.id)
      .eq("coupon_id", couponId)
      .maybeSingle();

    if (existingError) {
      setLoading(false);
      alert(existingError.message);
      return;
    }

    if (existing) {
      setLoading(false);
      alert("You already claimed this coupon.");
      location.href = "/my-coupons";
      return;
    }

    const { error } = await supabase
      .from("user_coupons")
      .insert({
        user_id: user.id,
        coupon_id: couponId,
        status: "claimed",
      });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Coupon saved successfully.");
    location.href = "/my-coupons";
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
        disabled:opacity-60
      "
    >
      {loading ? "Saving..." : "Claim Coupon"}
    </button>
  );
}