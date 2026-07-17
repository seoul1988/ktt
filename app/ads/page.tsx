"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import CommunityBottomNav from "../components/CommunityBottomNav";
import ProfileButton from "@/app/components/ProfileButton";
import BackButton from "@/app/components/BackButton";


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

const categoryTabs = [
  { label: "전체", value: "all", href: "/ads" },
  { label: "구인·구직", value: "job", href: "/ads?category=job" },
  { label: "부동산", value: "housing", href: "/ads?category=housing" },
  { label: "자동차", value: "auto", href: "/ads?category=auto" },
  { label: "비즈니스", value: "business", href: "/ads?category=business" },
  { label: "이벤트", value: "event", href: "/ads?category=event" },
  { label: "공연/문화", value: "culture", href: "/ads?category=culture" },
  { label: "서비스", value: "service", href: "/ads?category=service" },
  { label: "모임", value: "group", href: "/ads?category=group" },
];

const validCategories = categoryTabs.map((tab) => tab.value);

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

function categoryLabel(category: string | null) {
  if (category === "job") return "구인·구직";
  if (category === "housing") return "부동산";
  if (category === "auto") return "자동차";
  if (category === "event") return "이벤트";
  if (category === "service") return "서비스";
  if (category === "group") return "모임";
  return "비즈니스";
}

function getStoragePathFromUrl(url: string, bucketName: string) {
  if (!url || typeof url !== "string") return null;

  const marker = `/storage/v1/object/public/${bucketName}/`;
  const index = url.indexOf(marker);

  if (index !== -1) {
    return decodeURIComponent(url.substring(index + marker.length));
  }

  if (!url.startsWith("http") && url.includes("/")) {
    return url;
  }

  return null;
}

export default function AdsPage() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [ads, setAds] = useState<AdItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const category = params.get("category") || "all";

    if (validCategories.includes(category)) {
      setSelectedCategory(category);
    } else {
      setSelectedCategory("all");
      window.history.replaceState(null, "", "/ads");
    }
  }, []);

  useEffect(() => {
    loadPage();
  }, [selectedCategory]);

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

    if (selectedCategory !== "all") {
      query = query.eq("category", selectedCategory);
    }

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

  async function deleteAd(id: number) {
    const ok = window.confirm("Delete this ad?");
    if (!ok) return;

    setDeletingId(id);

    try {
      const targetAd = ads.find((ad) => ad.id === id);

      const filesToDelete: string[] = [];

      if (Array.isArray(targetAd?.images)) {
        targetAd.images.forEach((url) => {
          const path = getStoragePathFromUrl(url, "ads");
          if (path) filesToDelete.push(path);
        });
      }

      if (targetAd?.video_url) {
        const videoPath = getStoragePathFromUrl(targetAd.video_url, "ads");
        if (videoPath) filesToDelete.push(videoPath);
      }

      const uniqueFilesToDelete = Array.from(new Set(filesToDelete));

      console.log("Files to delete:", uniqueFilesToDelete);

      if (uniqueFilesToDelete.length > 0) {
        const { data: storageData, error: storageError } =
          await supabase.storage.from("ads").remove(uniqueFilesToDelete);

        console.log("Storage delete data:", storageData);
        console.log("Storage delete error:", storageError);

        if (storageError) {
          alert("Storage file delete failed: " + storageError.message);
          setDeletingId(null);
          return;
        }
      }

      const { data, error } = await supabase
        .from("ads")
        .delete()
        .eq("id", id)
        .select("id");

      if (error) {
        alert("Failed to delete ad: " + error.message);
        setDeletingId(null);
        return;
      }

      if (!data || data.length === 0) {
        alert(
          "Delete did not complete. This is usually caused by Supabase RLS policy."
        );
        setDeletingId(null);
        return;
      }

      setAds((prev) => prev.filter((ad) => ad.id !== id));
    } finally {
      setDeletingId(null);
    }
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
      <div className="mx-auto w-full max-w-xl">
        <div className="relative mb-5 flex h-10 items-center">
  {/* 왼쪽 */}
  <BackButton />

  {/* 가운데 */}
  <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-2xl font-black text-[#172033]">
    Ads
  </h1>

  {/* 오른쪽 */}
  <div className="ml-auto flex items-center gap-2">
    <Link
      href="/ads/my"
      className="rounded-full border border-[#172033] px-2.5 py-1 text-[11px] font-bold text-[#172033]"
    >
      My Ads
    </Link>

    <Link
      href="/ads/new"
      className="rounded-full bg-[#172033] px-2.5 py-1 text-[11px] font-bold text-white"
    >
      + Add
    </Link>

    <ProfileButton />
  </div>
</div>

        <div className="mb-4 -mx-4 border-b border-[#172033]/15">
  <div
    className="
      flex
      overflow-x-auto
      whitespace-nowrap
      gap-2
      px-4
      pb-2
      scrollbar-hide
      snap-x
      snap-mandatory
    "
  >
            {categoryTabs.map((tab) => (
              <Link
                key={tab.value}
                href={tab.href}
                onClick={() => setSelectedCategory(tab.value)}
                className={`relative pb-2 text-[12px] font-black ${
                  selectedCategory === tab.value
                    ? "text-[#172033]"
                    : "text-gray-500"
                }`}
              >
                {tab.label}
                {selectedCategory === tab.value && (
                  <span className="absolute bottom-0 left-0 h-[2px] w-full rounded-full bg-[#172033]" />
                )}
              </Link>
            ))}
          </div>
        </div>

        {ads.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow">
            <p className="text-sm font-bold text-gray-500">
              No ads have been posted yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 items-stretch gap-3">
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
                  className={`relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow ${
                    ad.status === "expired" || ad.status === "hidden"
                      ? "opacity-70"
                      : ""
                  }`}
                >
                  <Link href={`/ads/${ad.id}`} className="flex min-h-0 flex-1 flex-col">
                    {hasMedia && (
                      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-gray-100">
                        {hasVideo ? (
                          <video
                            src={cleanVideoUrl || ""}
                            muted
                            playsInline
                            preload="metadata"
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        ) : (
                          <img
                            src={cleanImages[0]}
                            alt={ad.title}
                            loading="lazy"
                            className="absolute inset-0 h-full w-full object-cover"
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

                    <div className="flex min-h-0 flex-1 flex-col bg-white p-3">
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

                        <span className="shrink-0 rounded-full bg-[#172033]/10 px-2 py-1 text-[10px] font-black text-[#172033]">
                          {categoryLabel(ad.category)}
                        </span>
                      </div>

                      <div className="mt-1 h-5 overflow-hidden">
                        {ad.phone ? (
                          <p className="text-xs font-bold text-[#C2410C]">
                            {ad.phone}
                          </p>
                        ) : (
                          <p className="text-xs text-transparent">No phone</p>
                        )}
                      </div>

                      <div className="mt-2 h-10 overflow-hidden">
                        {ad.description ? (
                          <p className="line-clamp-2 h-10 overflow-hidden text-xs leading-5 text-gray-600">
                            {ad.description}
                          </p>
                        ) : (
                          <p className="h-10 overflow-hidden text-xs leading-5 text-transparent">
                            No description
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>

                  {canManage && (
                    <div className="relative z-10 mt-auto grid shrink-0 grid-cols-3 gap-1 border-t bg-white p-2">
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