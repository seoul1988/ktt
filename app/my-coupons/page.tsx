"use client";

import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "../../lib/supabase";

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
      location.href = "/login";
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
    <main className="min-h-screen bg-[#F8F3EC] p-5 text-[#172033]">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-3xl font-black">
          My Coupons
        </h1>

        <div className="space-y-4">
          {items.map((item) => {
            const redeemUrl =
              `${location.origin}/redeem/${item.id}`;

            const coupon = item.coupons;

            return (
              <div
                key={item.id}
                className="rounded-3xl bg-white p-5 shadow"
              >
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
                    <QRCodeCanvas
                      value={redeemUrl}
                      size={180}
                    />
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl bg-gray-100 p-3 text-center font-bold">
                    Used
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}