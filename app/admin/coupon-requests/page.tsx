"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import ProfileButton from "../../components/ProfileButton";
import CommunityBottomNav from "../../components/CommunityBottomNav";

type Coupon = {
  id: number;
  business_id: number | null;
  title: string | null;
  description: string | null;
  coupon_type: string | null;
  value: number | null;
  start_date: string | null;
  end_date: string | null;
  usage_limit: number | null;
  used_count: number | null;
  active: boolean | null;
  status: string | null;
  businesses?: {
    name: string | null;
  }[] | null;
};

export default function CouponRequestsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCoupons();
  }, []);

  async function loadCoupons() {
    setLoading(true);

    const { data, error } = await supabase
      .from("coupons")
      .select(`
        id,
        business_id,
        title,
        description,
        coupon_type,
        value,
        start_date,
        end_date,
        usage_limit,
        used_count,
        active,
        status,
        businesses (
          name
        )
      `)
      .order("id", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setCoupons((data || []) as unknown as Coupon[]);
    setLoading(false);
  }

  async function approveCoupon(id: number) {
    const ok = window.confirm("Approve this coupon?");
    if (!ok) return;

    const { error } = await supabase
      .from("coupons")
      .update({ status: "approved" })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    setCoupons((prev) =>
      prev.map((coupon) =>
        coupon.id === id ? { ...coupon, status: "approved" } : coupon
      )
    );
  }

  async function rejectCoupon(id: number) {
    const ok = window.confirm("Reject this coupon?");
    if (!ok) return;

    const { error } = await supabase
      .from("coupons")
      .update({ status: "rejected" })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    setCoupons((prev) =>
      prev.map((coupon) =>
        coupon.id === id ? { ...coupon, status: "rejected" } : coupon
      )
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-5 pb-28 pt-8 text-[#172033]">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            href="/admin"
            className="rounded-full bg-white px-4 py-2 text-sm font-bold shadow"
          >
            ← Back
          </Link>

          <h1 className="flex-1 text-center text-3xl font-black">
            Coupon Requests
          </h1>

          <ProfileButton />
        </div>

        {loading ? (
          <div className="rounded-3xl bg-white p-5 font-bold shadow">
            Loading...
          </div>
        ) : coupons.length === 0 ? (
          <div className="rounded-3xl bg-white p-5 font-bold shadow">
            No coupon requests.
          </div>
        ) : (
          <div className="space-y-4">
            {coupons.map((coupon) => {
              const status = String(coupon.status || "pending")
                .trim()
                .toLowerCase();

              return (
                <div
                  key={coupon.id}
                  className="rounded-3xl bg-white p-5 shadow"
                >
                  <p className="text-sm font-bold text-gray-500">
                   {coupon.businesses?.[0]?.name || "No business"}
                  </p>

                  <h2 className="mt-1 text-xl font-black">
                    {coupon.title || "No title"}
                  </h2>

                  {coupon.description && (
                    <p className="mt-1 text-sm text-gray-600">
                      {coupon.description}
                    </p>
                  )}

                  <p className="mt-2 text-sm text-gray-600">
                    Type: {coupon.coupon_type || "-"} / Value:{" "}
                    {coupon.value ?? "-"}
                  </p>

                  <p className="mt-1 text-sm text-gray-600">
                    Used: {coupon.used_count || 0} / {coupon.usage_limit || 0}
                  </p>

                  <div className="mt-4 flex gap-2">
                    {status === "approved" ? (
                      <button
                        disabled
                        className="cursor-not-allowed rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white opacity-90"
                      >
                        Approved
                      </button>
                    ) : status === "rejected" ? (
                      <button
                        disabled
                        className="cursor-not-allowed rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white opacity-90"
                      >
                        Rejected
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => approveCoupon(coupon.id)}
                          className="rounded-lg bg-green-600 px-3 py-2 text-sm font-bold text-white"
                        >
                          Approve
                        </button>

                        <button
                          onClick={() => rejectCoupon(coupon.id)}
                          className="rounded-lg bg-red-500 px-3 py-2 text-sm font-bold text-white"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CommunityBottomNav />
    </main>
  );
}