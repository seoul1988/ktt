"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import CommunityBottomNav from "../../components/CommunityBottomNav";

type Ad = {
  id: number;
  owner_id: string | null;
  user_id: string | null;
  title: string | null;
  description: string | null;
  category: string | null;
  location: string | null;
  phone: string | null;
  images: string[] | null;
  video_url: string | null;
  status: string | null;
  created_at: string | null;
  display_order: number | null;
};

function getStoragePathFromPublicUrl(url: string, bucketName: string) {
  const marker = `/storage/v1/object/public/${bucketName}/`;
  const index = url.indexOf(marker);

  if (index === -1) return null;

  return decodeURIComponent(url.substring(index + marker.length));
}

export default function AdminAdsPage() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    loadAds();
  }, []);

  async function loadAds() {
    setLoading(true);

    const { data, error } = await supabase
      .from("ads")
      .select(
        "id,owner_id,user_id,title,description,category,location,phone,images,video_url,status,created_at,display_order"
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

  async function changeDisplayOrder(id: number, displayOrder: number) {
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
        .sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999))
    );
  }

  async function changeStatus(id: number, status: "active" | "hidden") {
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

  async function deleteAd(ad: Ad) {
    const ok = window.confirm("Delete this ad and all image/video files?");
    if (!ok) return;

    setDeletingId(ad.id);

    const imagePaths = Array.isArray(ad.images)
      ? (ad.images
          .map((url) => getStoragePathFromPublicUrl(url, "ads"))
          .filter(Boolean) as string[])
      : [];

    const videoPath = ad.video_url
      ? getStoragePathFromPublicUrl(ad.video_url, "ads")
      : null;

    const mediaPaths = [...imagePaths, ...(videoPath ? [videoPath] : [])];

    if (mediaPaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("ads")
        .remove(mediaPaths);

      if (storageError) {
        console.error("Storage delete error:", storageError);
        alert("Media delete failed: " + storageError.message);
        setDeletingId(null);
        return;
      }
    }

    const { data, error } = await supabase
      .from("ads")
      .delete()
      .eq("id", ad.id)
      .select("id");

    setDeletingId(null);

    if (error) {
      console.error("Ad delete error:", error);
      alert("Ad delete failed: " + error.message);
      return;
    }

    if (!data || data.length === 0) {
      alert("Delete did not complete. Check Supabase RLS policy.");
      return;
    }

    setAds((prev) => prev.filter((item) => item.id !== ad.id));
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

              const cleanImages = Array.isArray(ad.images)
                ? ad.images.filter(
                    (img) => typeof img === "string" && img.trim() !== ""
                  )
                : [];

              const hasImage = cleanImages.length > 0;
              const hasVideo =
                typeof ad.video_url === "string" &&
                ad.video_url.trim() !== "";

              return (
                <div key={ad.id} className="rounded-3xl bg-white p-4 shadow">
                  {hasVideo ? (
                    <video
                      src={ad.video_url || ""}
                      controls
                      className="mb-3 h-40 w-full rounded-2xl object-cover"
                    />
                  ) : (
                    hasImage && (
                      <img
                        src={cleanImages[0]}
                        alt={ad.title || "Ad"}
                        className="mb-3 h-40 w-full rounded-2xl object-cover"
                      />
                    )
                  )}

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-black">
                        {ad.title || "Untitled Ad"}
                      </h2>

                      {ad.category && (
                        <p className="mt-1 text-xs font-black text-[#C2410C]">
                          {ad.category}
                        </p>
                      )}

                      {ad.location && (
                        <p className="mt-1 text-sm text-gray-600">
                          Location: {ad.location}
                        </p>
                      )}

                      {ad.phone && (
                        <p className="mt-1 text-sm text-gray-600">
                          Phone: {ad.phone}
                        </p>
                      )}

                      {ad.description && (
                        <p className="mt-1 text-sm text-gray-600">
                          {ad.description}
                        </p>
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
                      type="button"
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
                      type="button"
                      disabled={deletingId === ad.id}
                      onClick={() => deleteAd(ad)}
                      className="col-span-2 rounded-xl bg-red-500 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                    >
                      {deletingId === ad.id ? "Deleting..." : "Delete"}
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