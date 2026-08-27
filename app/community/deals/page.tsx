import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import CommunityBottomNav from "../../components/CommunityBottomNav";
import ProfileButton from "@/app/components/ProfileButton";
import BackButton from "@/app/components/BackButton";



export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CommunityDealsPage() {
  const today = new Date().toISOString().slice(0, 10);

  const { data: deals } = await supabase
    .from("deals")
    .select("*")
    .eq("active", true)
    .eq("status", "approved")
    .eq("deal_scope", "community")
    .or(`end_date.is.null,end_date.gte.${today}`)
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-[#F8F3EC] text-[#172033]">
      <section className="mx-auto max-w-2xl px-5 pb-28 pt-4">
        <div className="relative mb-5 flex h-10 items-center border-b border-[#E8DED1] pb-3">
  {/* 왼쪽 */}
  <BackButton />

  {/* 가운데 */}
  <h1 className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-lg font-black text-[#172033]">
    Community Deals
  </h1>

  {/* 오른쪽 */}
  <div className="ml-auto flex items-center gap-2">
    <Link
      href="/community/deals/new"
      className="rounded-full bg-[#C4483A] px-2.5 py-1 text-[11px] font-black text-white shadow-sm transition active:scale-95"
    >
      + 등록
    </Link>

    <ProfileButton />
  </div>
</div>

        <div className="space-y-5">
          {deals?.map((deal) => (
            <Link
              key={deal.id}
              href={`/community/deals/${deal.id}`}
              className="block overflow-hidden rounded-3xl bg-white shadow-sm transition active:scale-[0.98]"
            >
              <div className="relative h-52 w-full overflow-hidden bg-[#E8DED1]">
                {deal.image_url ? (
                  <img
                    src={deal.image_url}
                    alt={deal.title || "Deal"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm font-black text-[#6B6257]">
                    No Photo
                  </div>
                )}
              </div>

              <div className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-black leading-snug">
                    {deal.title}
                  </h2>

                  <span className="rounded-full bg-[#F4C95D] px-2.5 py-1 text-[10px] font-black text-[#172033]">
                    DEAL
                  </span>

                  {deal.discount_text && (
                    <span className="rounded-full bg-[#C4483A] px-3 py-1 text-[10px] font-black text-white">
                      {deal.discount_text}
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm font-bold text-[#6B6257]">
                  {deal.business_name || "Local Business"}
                </p>

                {deal.description && (
                  <p className="mt-3 line-clamp-3 text-sm font-semibold leading-6 text-[#6B6257]">
                    {deal.description}
                  </p>
                )}

                {deal.end_date && (
                  <p className="mt-3 text-xs font-black text-[#C4483A]">
                    Ends {new Date(deal.end_date).toLocaleDateString()}
                  </p>
                )}
              </div>
            </Link>
          ))}

          {!deals?.length && (
            <div className="rounded-3xl bg-white p-8 text-center text-sm font-bold text-[#6B6257]">
              등록된 Community Deal이 없습니다.
            </div>
          )}
        </div>
      </section>

      <CommunityBottomNav activeNav="deals" />
    </main>
  );
}