import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import CommunityBottomNav from "../../components/CommunityBottomNav";

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
      <section className="mx-auto max-w-xl px-5 pb-28 pt-6">
        <div className="mb-5 flex items-center justify-between border-b border-[#E8DED1] pb-3">
  <Link
    href="/community"
    className="text-sm font-bold text-[#C4483A]"
  >
    ← Back
  </Link>

  <div className="text-right">
    <p className="text-[11px] font-black tracking-[0.18em] text-[#C4483A]">
      COMMUNITY
    </p>

    <h1 className="text-xl font-black text-[#172033]">
      Deals
    </h1>
  </div>
</div>

        <div className="space-y-5">
          {deals?.map((deal) => (
            <Link
              key={deal.id}
              href={`/community/deals/${deal.id}`}
              className="block overflow-hidden rounded-3xl bg-white shadow-sm"
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

                <div className="absolute left-3 top-3 rounded-full bg-[#F4C95D] px-3 py-1 text-xs font-black text-[#172033]">
                  DEAL
                </div>

                {deal.discount_text && (
                  <div className="absolute bottom-3 left-3 rounded-full bg-[#C4483A] px-4 py-2 text-sm font-black text-white">
                    {deal.discount_text}
                  </div>
                )}
              </div>

              <div className="p-5">
                <h2 className="text-xl font-black">
                  {deal.title}
                </h2>

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
                    Ends{" "}
                    {new Date(deal.end_date).toLocaleDateString()}
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

      <CommunityBottomNav activeNav="community" />
    </main>
  );
}