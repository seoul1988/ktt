"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import CommunityBottomNav from "../components/CommunityBottomNav";

type AdItem = {
  id: number;
  user_id: string | null;
  title: string;
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

function statusLabel(status: string | null) {
  if (status === "active") return "Active";
  if (status === "expired") return "Expired";
  if (status === "hidden") return "Hidden";
  return "Active";
}

function statusClass(status: string | null) {
  if (status === "active" || !status) return "bg-green-600";
  if (status === "expired") return "bg-gray-500";
  if (status === "hidden") return "bg-red-500";
  return "bg-green-600";
}

export default function AdsPage() {
  const [ads, setAds] = useState<AdItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id || null;
    setCurrentUserId(userId);

    let admin = false;

    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      admin = profile?.role === "admin";
      setIsAdmin(admin);
    }

    let query = supabase
      .from("ads")
      .select("*")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (!admin && userId) {
      query = query.or(`status.is.null,status.eq.active,user_id.eq.${userId}`);
    } else if (!admin && !userId) {
      query = query.or("status.is.null,status.eq.active");
    }

    const { data, error } = await query;

    if (error) {
      alert("Failed to load ads: " + error.message);
      setLoading(false);
      return;
    }

    setAds((data || []) as AdItem[]);
    setLoading(false);
  }

  async function toggleVisibility(id: number, currentStatus: string | null) {
    const nextStatus = currentStatus === "hidden" ? "active" : "hidden";

    const { error } = await supabase
      .from("ads")
      .update({ status: nextStatus })
      .eq("id", id);

    if (error) {
      alert("Failed to update ad: " + error.message);
      return;
    }

    setAds((prev) =>
      prev.map((ad) => (ad.id === id ? { ...ad, status: nextStatus } : ad))
    );
  }
function getStoragePathFromPublicUrl(url: string, bucketName: string) {
  const marker = `/storage/v1/object/public/${bucketName}/`;
  const index = url.indexOf(marker);

  if (index === -1) return null;

  return decodeURIComponent(url.substring(index + marker.length));
}
  async function deleteAd(ad: AdItem) {
  const ok = window.confirm("Delete this ad and all media files?");
  if (!ok) return;

  setDeletingId(ad.id);

  const imagePaths =
    Array.isArray(ad.images)
      ? ad.images
          .map((url) => getStoragePathFromPublicUrl(url, "ads"))
          .filter(Boolean) as string[]
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
    console.error("Delete ad error:", error);
    alert("Failed to delete ad: " + error.message);
    return;
  }

  if (!data || data.length === 0) {
    alert("Delete did not complete. Check Supabase RLS policy.");
    return;
  }

  setAds((prev) => prev.filter((item) => item.id !== ad.id));
}
  if (loading) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] p-4 pb-24">
        <div className="mx-auto max-w-md rounded-3xl bg-white p-6 font-bold shadow">
          Loading...
        </div>
        <CommunityBottomNav activeNav="ads" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-4 pb-24">
      <div className="mx-auto max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-black text-[#172033]">Ads</h1>

          <div className="flex gap-2">
            <Link
              href="/ads/my"
              className="rounded-full border border-[#172033] px-4 py-2 text-sm font-bold text-[#172033]"
            >
              My Ads
            </Link>

            <Link
              href="/ads/new"
              className="rounded-full bg-[#172033] px-4 py-2 text-sm font-bold text-white"
            >
              + Add
            </Link>
          </div>
        </div>

        {ads.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow">
            <p className="text-sm font-bold text-gray-500">
              No ads have been posted yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {ads.map((ad) => {
              const cleanImages = Array.isArray(ad.images)
                ? ad.images.filter(
                    (img) => typeof img === "string" && img.trim() !== ""
                  )
                : [];

              const cleanVideoUrl =
                typeof ad.video_url === "string" && ad.video_url.trim() !== ""
                  ? ad.video_url
                  : null;

              const hasVideo = Boolean(cleanVideoUrl);
              const hasMedia = cleanImages.length > 0 || hasVideo;

              const canManage =
                Boolean(currentUserId && ad.user_id === currentUserId) ||
                isAdmin;

              return (
                <div
                  key={ad.id}
                  className={`overflow-hidden rounded-2xl bg-white shadow ${
                    ad.status === "expired" || ad.status === "hidden"
                      ? "opacity-70"
                      : ""
                  }`}
                >
                  <Link href={`/ads/${ad.id}`} className="block">
                    {hasMedia && (
                      <div className="relative h-32 bg-black">
                        {hasVideo ? (
                          <video
                            src={cleanVideoUrl || ""}
                            muted
                            playsInline
                            preload="metadata"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <img
                            src={cleanImages[0]}
                            alt={ad.title}
                            className="h-full w-full object-cover"
                          />
                        )}

                        {hasVideo && (
                          <div className="absolute left-2 top-2 rounded-full bg-red-600 px-2 py-1 text-[10px] font-black text-white">
                            VIDEO
                          </div>
                        )}

                        {!hasVideo && cleanImages.length > 1 && (
                          <div className="absolute bottom-2 right-2 rounded-full bg-black/80 px-2 py-1 text-[10px] font-black text-white">
                            1/{cleanImages.length}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black text-white ${statusClass(
                            ad.status
                          )}`}
                        >
                          {statusLabel(ad.status)}
                        </span>

                        <span className="line-clamp-1 text-[11px] font-bold text-gray-500">
                          {ad.location || ""}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <h2 className="line-clamp-1 flex-1 text-sm font-black text-[#172033]">
                          {ad.title}
                        </h2>

                        {ad.category && (
                          <span className="shrink-0 rounded-full bg-[#172033]/10 px-2 py-1 text-[10px] font-black text-[#172033]">
                            {ad.category}
                          </span>
                        )}
                      </div>

                      {ad.phone && (
                        <p className="mt-1 text-xs font-bold text-[#C2410C]">
                          {ad.phone}
                        </p>
                      )}

                      {ad.description && (
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-600">
                          {ad.description}
                        </p>
                      )}
                    </div>
                  </Link>

                  {canManage && (
                    <div className="grid grid-cols-3 gap-1 border-t p-2">
                      <button
                        type="button"
                        onClick={() => toggleVisibility(ad.id, ad.status)}
                        className={`rounded-xl py-2 text-[11px] font-black text-white ${
                          ad.status === "hidden"
                            ? "bg-green-600"
                            : "bg-gray-600"
                        }`}
                      >
                        {ad.status === "hidden" ? "Show" : "Hide"}
                      </button>

                      <Link
                        href={`/ads/${ad.id}/edit`}
                        className="rounded-xl bg-blue-600 py-2 text-center text-[11px] font-black text-white"
                      >
                        Edit
                      </Link>

                      <button
                        type="button"
                        disabled={deletingId === ad.id}
                        onClick={() => deleteAd(ad.id)}
                        className="rounded-xl bg-red-500 py-2 text-[11px] font-black text-white disabled:opacity-50"
                      >
                        {deletingId === ad.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CommunityBottomNav activeNav="ads" />
    </main>
  );
}