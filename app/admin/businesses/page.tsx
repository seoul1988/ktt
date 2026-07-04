"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import Link from "next/link";
import CommunityBottomNav from "../../components/CommunityBottomNav";

export const dynamic = "force-dynamic";

type Business = {
  id: number;
  name: string | null;
  address: string | null;
  phone: string | null;
  category: string | null;
  display_order: number | null;
  featured_sponsor: boolean | null;
};

export default function AdminBusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [sponsorSavingId, setSponsorSavingId] = useState<number | null>(null);
  const [orders, setOrders] = useState<Record<number, string>>({});

  useEffect(() => {
    loadBusinesses();
  }, []);

  async function loadBusinesses() {
    setLoading(true);

    const { data, error } = await supabase
      .from("businesses")
      .select("id,name,address,phone,category,display_order,featured_sponsor")
      .order("category", { ascending: true, nullsFirst: false })
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("id", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const rows = (data || []) as Business[];
    setBusinesses(rows);

    const nextOrders: Record<number, string> = {};
    rows.forEach((b) => {
      nextOrders[b.id] = String(b.display_order ?? 999);
    });
    setOrders(nextOrders);

    setLoading(false);
  }

  const groupedBusinesses = useMemo(() => {
    const groups: Record<string, Business[]> = {};

    businesses.forEach((business) => {
      const category = business.category?.trim() || "No Category";
      if (!groups[category]) groups[category] = [];
      groups[category].push(business);
    });

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [businesses]);

  async function saveDisplayOrder(id: number) {
    const value = Number(orders[id] || 999);

    if (Number.isNaN(value)) {
      alert("숫자만 입력하세요.");
      return;
    }

    setSavingId(id);

    const { error } = await supabase
      .from("businesses")
      .update({ display_order: value })
      .eq("id", id);

    if (error) {
      alert(error.message);
      setSavingId(null);
      return;
    }

    setBusinesses((prev) =>
      prev
        .map((b) => (b.id === id ? { ...b, display_order: value } : b))
        .sort((a, b) => {
          const catA = a.category || "";
          const catB = b.category || "";
          if (catA !== catB) return catA.localeCompare(catB);
          return (a.display_order ?? 999) - (b.display_order ?? 999);
        }),
    );

    setSavingId(null);
  }

  async function toggleFeaturedSponsor(id: number, currentValue: boolean | null) {
    const nextValue = !Boolean(currentValue);

    setSponsorSavingId(id);

    const { error } = await supabase
      .from("businesses")
      .update({ featured_sponsor: nextValue })
      .eq("id", id);

    if (error) {
      alert("Featured Sponsor 변경 실패: " + error.message);
      setSponsorSavingId(null);
      return;
    }

    setBusinesses((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, featured_sponsor: nextValue } : b,
      ),
    );

    setSponsorSavingId(null);
  }

  async function deleteBusiness(id: number, name: string | null) {
    const ok = window.confirm(`"${name || "No name"}" business를 삭제할까요?`);
    if (!ok) return;

    const { error: ownerError } = await supabase
      .from("business_owners")
      .delete()
      .eq("business_id", id);

    if (ownerError) {
      alert("business_owners 삭제 실패: " + ownerError.message);
      return;
    }

    const { error: businessError } = await supabase
      .from("businesses")
      .delete()
      .eq("id", id);

    if (businessError) {
      alert("businesses 삭제 실패: " + businessError.message);
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
          <div className="space-y-7">
            {groupedBusinesses.map(([category, items]) => (
              <section key={category}>
                <div className="mb-3 flex items-center justify-between rounded-2xl bg-[#172033] px-4 py-1.5 text-white shadow">
                  <h2 className="text-lg font-black">{category}</h2>

                  <span className="text-xs font-bold text-white/70">
                    낮은 숫자가 먼저 노출
                  </span>
                </div>

                <div className="space-y-4">
                  {items.map((business) => (
                    <div
                      key={business.id}
                      className="rounded-3xl bg-white p-5 shadow"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-xl font-black">
                              {business.name || "No business name"}
                            </h3>

                            {business.featured_sponsor && (
                              <span className="rounded-full bg-yellow-400 px-2.5 py-1 text-[11px] font-black text-black">
                                ⭐ Sponsor
                              </span>
                            )}
                          </div>

                          <p className="mt-1 text-sm text-gray-600">
                            {business.address || "No address"}
                          </p>

                          {business.phone && (
                            <p className="mt-1 text-sm text-gray-600">
                              Phone: {business.phone}
                            </p>
                          )}
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-[11px] font-black text-gray-500">
                            ORDER
                          </p>
                          <input
                            type="number"
                            value={orders[business.id] ?? "999"}
                            onChange={(e) =>
                              setOrders((prev) => ({
                                ...prev,
                                [business.id]: e.target.value,
                              }))
                            }
                            className="mt-1 w-20 rounded-xl border border-gray-200 px-3 py-2 text-center text-sm font-black outline-none"
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          onClick={() => saveDisplayOrder(business.id)}
                          disabled={savingId === business.id}
                          className="rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                        >
                          {savingId === business.id ? "Saving..." : "Save Order"}
                        </button>

                        <button
                          onClick={() =>
                            toggleFeaturedSponsor(
                              business.id,
                              business.featured_sponsor,
                            )
                          }
                          disabled={sponsorSavingId === business.id}
                          className={`rounded-xl px-4 py-2 text-sm font-bold shadow-sm disabled:opacity-50 ${
                            business.featured_sponsor
                              ? "bg-yellow-400 text-black"
                              : "bg-gray-200 text-gray-700"
                          }`}
                        >
                          {sponsorSavingId === business.id
                            ? "Saving..."
                            : business.featured_sponsor
                              ? "⭐ Sponsor"
                              : "Set Sponsor"}
                        </button>

                        <Link
                          href={`/business/${business.id}/edit`}
                          className="rounded-xl bg-[#172033] px-4 py-2 text-sm font-bold text-white"
                        >
                          Edit
                        </Link>

                        <button
                          onClick={() =>
                            deleteBusiness(business.id, business.name)
                          }
                          className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <CommunityBottomNav />
    </main>
  );
}