"use client";

import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "../../lib/supabase";
import ProfileButton from "../components/ProfileButton";
import BottomNav from "../components/BottomNav";

export default function MyCouponsPage() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    loadCoupons();
  }, []);

  async function loadCoupons() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data, error } = await supabase
      .from("user_coupons")
      .select(`
        id,
        status,
        claimed_at,
        used_at,
        coupons (
          id,
          title,
          description,
          coupon_type,
          value,
          end_date,
          business_id,
          businesses (
            name
          )
        )
      `)
      .eq("user_id", user.id)
      .order("claimed_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setItems(data || []);
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-5 pb-28 pt-5 text-[#172033]">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                window.location.href = "/";
              }}
              className="rounded-full bg-white px-4 py-2 text-sm font-bold shadow"
            >
              ← Back
            </button>

            <h1 className="text-3xl font-black">My Coupons</h1>
          </div>

          <ProfileButton />
        </div>

        <div className="space-y-4">
          {items.length === 0 ? (
            <div className="rounded-3xl bg-white p-8 text-center shadow">
              <p className="text-lg font-black text-[#172033]">
                You don't have any coupons yet.
              </p>

              <p className="mt-2 text-sm text-gray-500">
                Claim deals and coupons to see them here.
              </p>
            </div>
          ) : (
          items.map((item) => {
  const coupon = item.coupons;

 const redeemUrl = `${window.location.origin}/coupons/redeem/${item.id}`;

  return (
    <div key={item.id} className="rounded-3xl bg-white p-5 shadow">
      <p className="text-sm font-bold text-gray-500">
        {coupon?.businesses?.name}
      </p>

      <h2 className="mt-1 text-xl font-black">
        {coupon?.title}
      </h2>

      <p className="mt-1 text-sm text-gray-600">
        {coupon?.description}
      </p>

      <p className="mt-2 text-sm font-bold">
        Status: {item.status}
      </p>

      {item.status === "claimed" ? (
        <div className="mt-4 flex justify-center rounded-2xl border p-4">
          <QRCodeCanvas value={redeemUrl} size={180} />
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-gray-100 p-3 text-center font-bold">
          Used
        </p>
      )}
    </div>
  );
})
          )}
        </div>
      </div>

      <BottomNav />
    </main>
  );
}