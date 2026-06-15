"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import ProfileButton from "../../components/ProfileButton";

type GrandOpening = {
  id: string;
  user_id: string | null;
  title: string | null;
  business_name: string | null;
  description: string | null;
  address: string | null;
  phone: string | null;
  opening_date: string | null;
  images: string[] | null;
  video_url: string | null;
  link_url: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string | null;
};

function getYoutubeEmbedUrl(url: string | null | undefined) {
  if (!url) return null;

  const value = String(url);

  if (value.includes("youtube.com/watch?v=")) {
    const id = value.split("v=")[1]?.split("&")[0];
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }

  if (value.includes("youtu.be/")) {
    const id = value.split("youtu.be/")[1]?.split("?")[0];
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }

  return null;
}

export default function GrandOpeningDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);

  const [item, setItem] = useState<GrandOpening | null>(null);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadGrandOpening();
  }, []);

  async function loadGrandOpening() {
    setLoading(true);

    const { data, error } = await supabase
      .from("grand_openings")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      setItem(null);
      setLoading(false);
      return;
    }

    setItem(data);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setCanManage(false);
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const isOwner = data.user_id === user.id;
    const isAdmin = profile?.role === "admin";

    setCanManage(isOwner || isAdmin);
    setLoading(false);
  }

  async function deleteGrandOpening() {
    if (!item) return;

    const ok = confirm("Delete this Grand Opening?");
    if (!ok) return;

    setDeleting(true);

    const { error } = await supabase
      .from("grand_openings")
      .delete()
      .eq("id", item.id);

    setDeleting(false);

    if (error) {
      alert(error.message);
      return;
    }

    router.push("/");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] px-5 pt-8 text-[#172033]">
        <div className="mx-auto max-w-xl text-sm font-bold">Loading...</div>
      </main>
    );
  }

  if (!item) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] px-5 pt-8 text-[#172033]">
        <div className="mx-auto max-w-xl">
          <Link href="/" className="text-sm font-black">
            ← Back
          </Link>
          <div className="mt-5 rounded-3xl bg-white p-5 text-sm font-bold">
            Grand Opening not found.
          </div>
        </div>
      </main>
    );
  }

  const youtubeUrl = getYoutubeEmbedUrl(item.video_url);
  const firstImage = item.images?.[0] || "/event.png";

  const mapUrl =
    item.lat && item.lng
      ? `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`
      : item.address
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
          item.address
        )}`
      : null;

  return (
    <main className="min-h-screen bg-[#F8F3EC] text-[#172033]">
      <section className="mx-auto max-w-xl px-5 pb-28 pt-6">
        <div className="mb-5 flex items-center justify-between border-b border-[#E8DED1] pb-3">
          <Link href="/" className="text-sm font-black">
            ← Back
          </Link>

          <h1 className="text-lg font-black">Grand Opening</h1>

          <ProfileButton />
        </div>

        <div className="overflow-hidden rounded-3xl bg-white shadow-xl">
          <div className="w-full bg-black">
            {item.video_url ? (
              youtubeUrl ? (
                <iframe
                  src={youtubeUrl}
                  title={item.title || "Grand Opening Video"}
                  className="h-72 w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={item.video_url}
                  controls
                  autoPlay
                  muted
                  playsInline
                  className="max-h-[520px] w-full bg-black object-contain"
                />
              )
            ) : (
              <img
                src={firstImage}
                alt={item.title || "Grand Opening"}
                className="h-72 w-full object-cover"
              />
            )}
          </div>

          <div className="p-5">
            <p className="text-xs font-black text-[#C4483A]">
              {item.opening_date || "Coming Soon"}
            </p>

            <div className="mt-2 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-2xl font-black">
                  {item.business_name || "Grand Opening"}
                </h2>

                <p className="mt-1 text-sm font-bold text-gray-600">
                  {item.title}
                </p>
              </div>

              {canManage && (
                <div className="flex shrink-0 gap-2">
                  <Link
                    href={`/grand-openings/${item.id}/edit`}
                    className="rounded-full bg-[#F8F3EC] px-3 py-1.5 text-xs font-black"
                  >
                    Edit
                  </Link>

                  <button
                    type="button"
                    onClick={deleteGrandOpening}
                    disabled={deleting}
                    className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-black text-red-600 disabled:opacity-50"
                  >
                    {deleting ? "..." : "Delete"}
                  </button>
                </div>
              )}
            </div>

            {item.description && (
              <p className="mt-4 whitespace-pre-line text-sm leading-6 text-gray-700">
                {item.description}
              </p>
            )}

            {item.images && item.images.length > 0 && (
              <div className="mt-5 grid grid-cols-3 gap-2">
                {item.images.map((src, index) => (
                  <img
                    key={src}
                    src={src}
                    alt={`Grand Opening ${index + 1}`}
                    className="aspect-square rounded-2xl object-cover"
                  />
                ))}
              </div>
            )}

            <div className="mt-5 space-y-2">
              {item.address && (
                <p className="rounded-2xl bg-[#F8F3EC] px-4 py-3 text-sm font-bold">
                  📍 {item.address}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                {item.phone && (
                  <a
                    href={`tel:${item.phone}`}
                    aria-label="Call business"
                    className="flex items-center justify-center rounded-2xl bg-[#172033] px-4 py-3 text-xl font-black text-white"
                  >
                    ☎️
                  </a>
                )}

                {mapUrl && (
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center rounded-2xl bg-[#C4483A] px-4 py-3 text-sm font-black text-white"
                  >
                    Directions
                  </a>
                )}
              </div>

              {item.link_url && (
                <a
                  href={item.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-2xl border border-[#E8DED1] bg-white px-4 py-3 text-center text-sm font-black text-[#172033]"
                >
                  Visit Link
                </a>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}