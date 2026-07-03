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

const categoryTabs = [
  { label: "All", value: "all", href: "/ads" },
  { label: "Jobs", value: "job", href: "/ads?category=job" },
  { label: "Housing", value: "housing", href: "/ads?category=housing" },
  { label: "Auto", value: "auto", href: "/ads?category=auto" },
  { label: "Business", value: "business", href: "/ads?category=business" },
  { label: "Events", value: "event", href: "/ads?category=event" },
  { label: "Service", value: "service", href: "/ads?category=service" },
  {
    label: "Notice",
    value: "announcement",
    href: "/ads?category=announcement",
  },
];

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
  if (category === "job") return "Jobs";
  if (category === "housing") return "Housing";
  if (category === "auto") return "Auto";
  if (category === "event") return "Event";
  if (category === "service") return "Service";
  if (category === "announcement") return "Notice";
  return "Business";
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
  setSelectedCategory(params.get("category") || "all");
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

    const { data, error } = await supabase
      .from("ads")
      .delete()
      .eq("id", id)
      .select("id");

    setDeletingId(null);

    if (error) {
      alert("Failed to delete ad: " + error.message);
      return;
    }

    if (!data || data.length === 0) {
      alert(
        "Delete did not complete. This is usually caused by Supabase RLS policy."
      );
      return;
    }

    setAds((prev) => prev.filter((ad) => ad.id !== id));
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

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {categoryTabs.map((tab) => (
            <Link
              key={tab.value}
              href={tab.href}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-black ${
                selectedCategory === tab.value
                  ? "bg-[#172033] text-white"
                  : "bg-white text-[#172033]"
              }`}
            >
              {tab.label}
            </Link>
          ))}
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
                  className={`flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow ${
                    ad.status === "expired" || ad.status === "hidden"
                      ? "opacity-70"
                      : ""
                  }`}
                >
                  <Link href={`/ads/${ad.id}`} className="flex flex-1 flex-col">
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

                    <div className="flex flex-1 flex-col p-3">
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

                      <div className="mt-1 min-h-[16px]">
                        {ad.phone ? (
                          <p className="text-xs font-bold text-[#C2410C]">
                            {ad.phone}
                          </p>
                        ) : (
                          <p className="text-xs text-transparent">No phone</p>
                        )}
                      </div>

                      <div className="mt-2 min-h-[42px]">
                        {ad.description ? (
                          <p className="line-clamp-2 text-xs leading-5 text-gray-600">
                            {ad.description}
                          </p>
                        ) : (
                          <p className="text-xs leading-5 text-transparent">
                            No description
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>

                  {canManage && (
                    <div className="mt-auto grid grid-cols-3 gap-1 border-t p-2">
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