"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import Link from "next/link";
import CommunityBottomNav from "../../components/CommunityBottomNav";

type Business = {
  id: number;
  name: string | null;
  address: string | null;
  phone: string | null;
  category: string | null;
};

export default function AdminBusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBusinesses();
  }, []);

  async function loadBusinesses() {
    setLoading(true);

    const { data, error } = await supabase
      .from("businesses")
      .select("id,name,address,phone,category")
      .order("id", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setBusinesses((data || []) as Business[]);
    setLoading(false);
  }

  async function deleteBusiness(id: number, name: string | null) {
    const ok = window.confirm(
      `"${name || "No name"}" business를 삭제할까요?`
    );

    if (!ok) return;

    const { error } = await supabase
      .from("businesses")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    setBusinesses((prev) => prev.filter((b) => b.id !== id));
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
            Businesses
          </h1>
        </div>

        {loading ? (
          <div className="rounded-3xl bg-white p-5 font-bold shadow">
            Loading...
          </div>
        ) : businesses.length === 0 ? (
          <div className="rounded-3xl bg-white p-5 font-bold shadow">
            No businesses found.
          </div>
        ) : (
          <div className="space-y-4">
            {businesses.map((business) => (
              <div
                key={business.id}
                className="rounded-3xl bg-white p-5 shadow"
              >
                <h2 className="text-xl font-black">
                  {business.name || "No business name"}
                </h2>

                <p className="mt-1 text-sm text-gray-600">
                  {business.address || "No address"}
                </p>

                {business.category && (
                  <p className="mt-1 text-sm text-gray-600">
                    Category: {business.category}
                  </p>
                )}

                {business.phone && (
                  <p className="mt-1 text-sm text-gray-600">
                    Phone: {business.phone}
                  </p>
                )}

            <div className="mt-4 flex gap-2">
			  <Link
				href={`/business/${business.id}/edit`}
				className="rounded-xl bg-[#172033] px-4 py-2 text-sm font-bold text-white"
			  >
				Edit
			  </Link>

			  <button
				onClick={() => deleteBusiness(business.id, business.name)}
				className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white"
			  >
				Delete
			  </button>
			</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CommunityBottomNav />
    </main>
  );
}