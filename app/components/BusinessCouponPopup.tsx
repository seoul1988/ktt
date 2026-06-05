"use client";

import { useState } from "react";
import ClaimCouponButton from "@/app/components/ClaimCouponButton";

export default function BusinessCouponPopup({
  coupons,
}: {
  coupons: any[];
}) {
  const [open, setOpen] = useState(coupons.length > 0);

  if (!open || coupons.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-5">
      <div className="relative max-h-[80vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="absolute right-4 top-4 rounded-full bg-gray-100 px-3 py-1 text-lg font-black"
        >
          ×
        </button>

        <h2 className="mb-4 pr-10 text-2xl font-black">
          🎟 Coupons & Deals
        </h2>

        <div className="space-y-3">
          {coupons.map((coupon) => (
            <div key={coupon.id} className="rounded-2xl border p-4">
              <div className="font-black">
                {coupon.title || "Coupon"}
              </div>

              <div className="mt-1 text-sm text-gray-600">
                {coupon.description ||
                  (coupon.coupon_type === "percent" && coupon.value
                    ? `${coupon.value}% off`
                    : coupon.coupon_type === "fixed" && coupon.value
                    ? `$${coupon.value} off`
                    : "Special offer")}
              </div>

              <div className="mt-3">
                <ClaimCouponButton couponId={coupon.id} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}