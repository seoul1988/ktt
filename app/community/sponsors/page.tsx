import Link from "next/link";
import { supabase } from "../../../lib/supabase";

import CommunityBottomNav from "../components/CommunityBottomNav";
import ProfileButton from "../components/ProfileButton";

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
    <>
      <main className="min-h-screen bg-[#F8F3EC] text-[#172033]">
        <section className="mx-auto max-w-2xl px-5 pb-28 pt-6">
          {/* Header */}
          <div className="relative mb-7 flex min-h-[48px] items-center justify-between">
            {/* Left: Back */}
            <Link
              href="/community"
              aria-label="Back to community"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-xl font-black text-[#172033] shadow-sm transition hover:shadow-md active:scale-[0.96]"
            >
              ←
            </Link>

            {/* Center: Title */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 w-[calc(100%-120px)] -translate-x-1/2 -translate-y-1/2 text-center">
              <h1 className="truncate text-xl font-black tracking-tight text-[#172033]">
                ⭐ Featured Sponsor
              </h1>

              <p className="mt-0.5 text-[10px] font-black uppercase tracking-wide text-[#B98000]">
                Sponsored
              </p>
            </div>

            {/* Right: Profile */}
            <div className="relative z-10 flex shrink-0 items-center justify-center">
              <ProfileButton />
            </div>
          </div>

          {/* Sponsor Count */}
          {featuredSponsors.length > 0 && (
            <div className="mb-4 flex items-center justify-between px-1">
              <p className="text-xs font-bold text-[#6B6257]">
                Featured Sponsors
              </p>

              <span className="rounded-full bg-[#F4C95D] px-3 py-1 text-[10px] font-black text-[#172033]">
                {featuredSponsors.length}
              </span>
            </div>
          )}

          {/* Sponsor List */}
          {featuredSponsors.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {featuredSponsors.map((biz: any) => {
                const image =
                  biz.thumbnail_url ||
                  biz.image_url ||
                  biz.logo_url ||
                  null;

                const category =
                  biz.category ||
                  biz.category_name ||
                  "Business";

                return (
                  <Link
                    key={biz.id}
                    href={`/business/${biz.id}?from=community`}
                    className="group overflow-hidden rounded-3xl bg-white text-[#172033] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
                  >
                    {/* Image */}
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#E8DED1]">
                      {image ? (
                        <img
                          src={image}
                          alt={biz.name || "Featured Sponsor"}
                          loading="lazy"
                          decoding="async"
                          className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center px-3 text-center">
                          <div className="text-3xl">⭐</div>
                          <p className="mt-2 text-xs font-black text-[#6B6257]">
                            No Photo
                          </p>
                        </div>
                      )}

                      {/* Sponsor Badge */}
                      <div className="absolute left-3 top-3 rounded-full bg-[#F4C95D] px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#172033] shadow-lg">
                        SPONSOR
                      </div>
                    </div>

                    {/* Business Info */}
                    <div className="p-3">
                      <h2 className="line-clamp-1 text-sm font-black text-[#172033]">
                        {biz.name || "Business"}
                      </h2>

                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <p className="line-clamp-1 min-w-0 flex-1 text-xs font-semibold text-[#6B6257]">
                          {category}
                        </p>

                        {biz.rating ? (
                          <span className="shrink-0 text-xs font-black text-[#B98000]">
                            ★ {biz.rating}
                          </span>
                        ) : null}
                      </div>

                      {(biz.city || biz.state) && (
                        <p className="mt-2 line-clamp-1 text-[10px] font-bold text-[#8A8175]">
                          {[biz.city, biz.state].filter(Boolean).join(", ")}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-3xl border border-[#EEE4D7] bg-white p-8 text-center shadow-sm">
              <div className="text-4xl">⭐</div>

              <p className="mt-3 text-base font-black text-[#172033]">
                No sponsors yet.
              </p>

              <p className="mt-2 text-xs font-semibold leading-relaxed text-[#6B6257]">
                Featured Sponsor에 등록된 업체가 없습니다.
              </p>

              <Link
                href="/community"
                className="mt-5 inline-flex items-center justify-center rounded-full bg-[#172033] px-5 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-[#2A3448]"
              >
                Community로 돌아가기
              </Link>
            </div>
          )}
        </section>
      </main>

      <CommunityBottomNav />
    </>
  );
}
