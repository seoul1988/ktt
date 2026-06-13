"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import CommunityBottomNav from "../../components/CommunityBottomNav";

type Ad = {
  id: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  video_url: string | null;
  link_url: string | null;
  status: string | null;
  created_at: string | null;
  display_order: number | null;
};

export default function AdminAdsPage() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAds();
  }, []);

  async function loadAds() {
    setLoading(true);

    const { data, error } = await supabase
      .from("ads")
      .select(
        "id,title,description,image_url,video_url,link_url,status,created_at,display_order"
      )
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setAds((data || []) as Ad[]);
    setLoading(false);
  }

  async function changeDisplayOrder(id: string, displayOrder: number) {
    const { error } = await supabase
      .from("ads")
      .update({ display_order: displayOrder })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    setAds((prev) =>
      prev
        .map((ad) =>
          ad.id === id ? { ...ad, display_order: displayOrder } : ad
        )
        .sort(
          (a, b) =>
            (a.display_order ?? 999) - (b.display_order ?? 999)
        )
    );
  }

  async function changeStatus(id: string, status: "active" | "hidden") {
    const { error } = await supabase
      .from("ads")
      .update({ status })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    setAds((prev) =>
      prev.map((ad) => (ad.id === id ? { ...ad, status } : ad))
    );
  }

  async function deleteAd(id: string) {
    const ok = window.confirm("Delete this ad?");
    if (!ok) return;

    const { error } = await supabase.from("ads").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    setAds((prev) => prev.filter((ad) => ad.id !== id));
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

          <h1 className="text-3xl font-black">Ad Management</h1>
        </div>

        {loading ? (
          <div className="rounded-3xl bg-white p-5 font-bold shadow">
            Loading...
          </div>
        ) : ads.length === 0 ? (
          <div className="rounded-3xl bg-white p-5 font-bold shadow">
            No ads found.
          </div>
        ) : (
          <div className="space-y-4">
            {ads.map((ad) => {
              const isActive = (ad.status || "active") === "active";

              return (
                <div key={ad.id} className="rounded-3xl bg-white p-4 shadow">
                  {ad.image_url && (
                    <img
                      src={ad.image_url}
                      alt={ad.title || "Ad"}
                      className="mb-3 h-40 w-full rounded-2xl object-cover"
                    />
                  )}

                  {ad.video_url && (
                    <video
                      src={ad.video_url}
                      controls
                      className="mb-3 h-40 w-full rounded-2xl object-cover"
                    />
                  )}

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-black">
                        {ad.title || "Untitled Ad"}
                      </h2>

                      {ad.description && (
                        <p className="mt-1 text-sm text-gray-600">
                          {ad.description}
                        </p>
                      )}

                      {ad.link_url && (
                        <a
                          href={ad.link_url}
                          target="_blank"
                          className="mt-2 block text-xs font-bold text-blue-600"
                        >
                          Open Link
                        </a>
                      )}

                      {ad.created_at && (
                        <p className="mt-2 text-xs text-gray-400">
                          {new Date(ad.created_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black text-white ${
                        isActive ? "bg-green-600" : "bg-gray-500"
                      }`}
                    >
                      {isActive ? "Visible" : "Hidden"}
                    </span>
                  </div>

                  <div className="mt-4 rounded-2xl bg-[#F8F3EC] p-3">
                    <label className="mb-1 block text-xs font-black text-gray-500">
                      Display Order
                    </label>

                    <input
                      type="number"
                      value={ad.display_order ?? 999}
                      onChange={(e) =>
                        changeDisplayOrder(
                          ad.id,
                          Number(e.target.value) || 999
                        )
                      }
                      className="w-full rounded-xl border px-3 py-2 text-sm font-bold"
                    />

                    <p className="mt-1 text-[11px] font-bold text-gray-400">
                      Lower number shows first. Example: 1, 2, 3
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      onClick={() =>
                        changeStatus(ad.id, isActive ? "hidden" : "active")
                      }
                      className={`rounded-xl px-3 py-2 text-xs font-black text-white ${
                        isActive ? "bg-gray-600" : "bg-green-600"
                      }`}
                    >
                      {isActive ? "Hide" : "Show"}
                    </button>

                    <Link
                      href={`/ads/${ad.id}/edit`}
                      className="rounded-xl bg-blue-600 px-3 py-2 text-center text-xs font-black text-white"
                    >
                      Edit
                    </Link>

                    <button
                      onClick={() => deleteAd(ad.id)}
                      className="col-span-2 rounded-xl bg-red-500 px-3 py-2 text-xs font-black text-white"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CommunityBottomNav activeNav="admin" />
    </main>
  );
}