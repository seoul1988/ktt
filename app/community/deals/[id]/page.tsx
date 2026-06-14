"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";
import CommunityBottomNav from "../../../components/CommunityBottomNav";

export default function CommunityDealDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);

  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);

  useEffect(() => {
    loadDeal();
  }, []);

  async function loadDeal() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: dealData, error } = await supabase
      .from("deals")
      .select("*")
      .eq("id", id)
      .eq("deal_scope", "community")
      .single();

    if (error || !dealData) {
      router.push("/community/deals");
      return;
    }

    setDeal(dealData);

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      setCanManage(dealData.user_id === user.id || profile?.role === "admin");
    }

    setLoading(false);
  }

  async function handleDelete() {
    if (!deal) return;

    if (!confirm("정말 이 딜을 삭제하시겠습니까?")) return;

    setDeleting(true);

    const { error } = await supabase
      .from("deals")
      .delete()
      .eq("id", deal.id)
      .eq("deal_scope", "community");

    setDeleting(false);

    if (error) {
      alert(
        `삭제 오류\n\n메시지: ${error.message}\n코드: ${
          error.code || "없음"
        }\n상세: ${error.details || "없음"}`
      );
      return;
    }

    router.push("/community/deals");
  }

  if (loading || !deal) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] px-5 py-8 text-[#172033]">
        <p className="text-sm font-bold text-[#6B6257]">Loading...</p>
      </main>
    );
  }

  const directionsUrl =
    deal.lat && deal.lng
      ? `https://www.google.com/maps/dir/?api=1&destination=${deal.lat},${deal.lng}`
      : deal.address
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
          deal.address
        )}`
      : null;

  const websiteUrl =
    deal.website &&
    (String(deal.website).startsWith("http://") ||
      String(deal.website).startsWith("https://"))
      ? deal.website
      : deal.website
      ? `https://${deal.website}`
      : null;

  return (
    <main className="min-h-screen bg-[#F8F3EC] text-[#172033]">
      <section className="mx-auto max-w-xl px-5 pb-28 pt-6">
        <div className="mb-5 flex items-center gap-3">
          <Link
            href="/community/deals"
            className="text-sm font-black text-[#C4483A]"
          >
            ← Back
          </Link>

          <span className="text-sm font-black tracking-wider text-[#172033]">
            COMMUNITY DEAL
          </span>
        </div>

        <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="relative h-72 w-full overflow-hidden bg-[#E8DED1]">
            {deal.image_url ? (
              <button
                type="button"
                onClick={() => setImageOpen(true)}
                className="h-full w-full"
              >
                <img
                  src={deal.image_url}
                  alt={deal.title || "Community Deal"}
                  className="h-full w-full object-cover"
                />
              </button>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-black text-[#6B6257]">
                No Photo
              </div>
            )}

            {deal.discount_text && (
              <div className="absolute bottom-4 left-4 rounded-full bg-[#C4483A] px-5 py-2 text-base font-black text-white shadow-lg">
                {deal.discount_text}
              </div>
            )}
          </div>

          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <h1 className="min-w-0 flex-1 text-3xl font-black leading-tight">
                {deal.title || "Community Deal"}
              </h1>

              {canManage && (
                <div className="flex shrink-0 gap-2">
                  <Link
                    href={`/community/deals/${deal.id}/edit`}
                    className="rounded-full bg-[#172033] px-3 py-2 text-xs font-black text-white"
                  >
                    수정
                  </Link>

                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="rounded-full bg-red-500 px-3 py-2 text-xs font-black text-white disabled:opacity-60"
                  >
                    {deleting ? "삭제중" : "삭제"}
                  </button>
                </div>
              )}
            </div>

            <p className="mt-2 text-base font-bold text-[#6B6257]">
              {deal.business_name || "Local Business"}
            </p>

            {deal.description && (
              <p className="mt-5 whitespace-pre-wrap text-sm font-semibold leading-7 text-[#6B6257]">
                {deal.description}
              </p>
            )}

            <div className="mt-6 space-y-2 text-sm font-bold text-[#6B6257]">
              {deal.end_date && (
                <p>⏰ Ends {new Date(deal.end_date).toLocaleDateString()}</p>
              )}

              {websiteUrl && <p>🌐 {websiteUrl}</p>}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {deal.phone && (
                <a
                  href={`tel:${deal.phone}`}
                  className="rounded-2xl bg-[#C4483A] px-4 py-3 text-center text-sm font-black text-white"
                >
                  전화하기
                </a>
              )}

              {directionsUrl && (
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl bg-[#172033] px-4 py-3 text-center text-sm font-black text-white"
                >
                  길찾기
                </a>
              )}

              {websiteUrl && (
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="col-span-2 rounded-2xl bg-[#F4C95D] px-4 py-3 text-center text-sm font-black text-[#172033]"
                >
                  웹사이트 보기
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {imageOpen && deal.image_url && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setImageOpen(false)}
        >
          <button
            type="button"
            onClick={() => setImageOpen(false)}
            className="absolute right-4 top-4 rounded-full bg-white px-4 py-2 text-sm font-black text-[#172033]"
          >
            닫기
          </button>

          <img
            src={deal.image_url}
            alt={deal.title || "Deal image"}
            className="max-h-[85vh] max-w-full rounded-2xl object-contain"
          />
        </div>
      )}

      <CommunityBottomNav activeNav="community" />
    </main>
  );
}