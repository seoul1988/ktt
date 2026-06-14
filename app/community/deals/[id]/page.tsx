import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import CommunityBottomNav from "../../../components/CommunityBottomNav";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CommunityDealDetailPage({ params }: PageProps) {
  const { id } = await params;

  const { data: deal, error } = await supabase
    .from("deals")
    .select("*")
    .eq("id", id)
    .eq("deal_scope", "community")
    .single();

  if (error || !deal) {
    notFound();
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
        <div className="mb-5">
          <Link
            href="/community/deals"
            className="text-sm font-black text-[#C4483A]"
          >
            ← Back
          </Link>
        </div>

        <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="relative h-72 w-full overflow-hidden bg-[#E8DED1]">
            {deal.image_url ? (
              <img
                src={deal.image_url}
                alt={deal.title || "Community Deal"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-black text-[#6B6257]">
                No Photo
              </div>
            )}

            <div className="absolute left-4 top-4 rounded-full bg-[#F4C95D] px-4 py-2 text-xs font-black text-[#172033] shadow-lg">
              COMMUNITY DEAL
            </div>

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

              <Link
                href={`/community/deals/${deal.id}/edit`}
                className="shrink-0 rounded-full bg-[#172033] px-3 py-2 text-xs font-black text-white"
              >
                ✏ 수정
              </Link>
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
                <p>
                  ⏰ Ends {new Date(deal.end_date).toLocaleDateString()}
                </p>
              )}

              {deal.phone && <p>📞 {deal.phone}</p>}

              {deal.address && <p>📍 {deal.address}</p>}

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

      <CommunityBottomNav activeNav="community" />
    </main>
  );
}