import Link from "next/link";
import { supabase } from "../../../lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CommunitySponsorsPage() {
  const { data: sponsors, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("featured_sponsor", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("featured sponsors error:", error);
  }

  const featuredSponsors = sponsors ?? [];

  return (
    <main className="min-h-screen bg-[#F8F3EC] text-[#172033]">
      <section className="mx-auto max-w-2xl px-5 pb-20 pt-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-[#B98000]">
              Sponsored
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight">
              ⭐ Featured Sponsor
            </h1>
          </div>

          <Link
            href="/community"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-base font-black text-[#172033] shadow-sm"
            aria-label="Back to community"
          >
            ←
          </Link>
        </div>

        {featuredSponsors.length > 0 ? (
          <div className="grid grid-cols-2 gap-4">
            {featuredSponsors.map((biz: any) => (
              <Link
                key={biz.id}
                href={`/business/${biz.id}?from=community`}
                className="overflow-hidden rounded-3xl bg-white text-[#172033] shadow-sm transition hover:shadow-md active:scale-[0.99]"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#E8DED1]">
                  {biz.thumbnail_url || biz.image_url ? (
                    <img
                      src={biz.thumbnail_url || biz.image_url}
                      alt={biz.name || "Featured Sponsor"}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-black text-[#6B6257]">
                      No Photo
                    </div>
                  )}

                  <div className="absolute left-3 top-3 rounded-full bg-[#F4C95D] px-3 py-1 text-[10px] font-black text-[#172033] shadow-lg">
                    SPONSOR
                  </div>
                </div>

                <div className="p-3">
                  <h2 className="line-clamp-1 text-sm font-black">
                    {biz.name}
                  </h2>

                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="line-clamp-1 text-xs font-semibold text-[#6B6257]">
                      {biz.category || biz.category_name || "Business"}
                    </p>

                    {biz.rating ? (
                      <span className="shrink-0 text-xs font-black text-[#B98000]">
                        ★ {biz.rating}
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
            <div className="text-4xl">⭐</div>
            <p className="mt-3 text-base font-black">No sponsors yet.</p>
          </div>
        )}
      </section>
    </main>
  );
}
