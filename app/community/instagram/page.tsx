import Link from "next/link";

import { supabase } from "../../../lib/supabase";
import CommunityBottomNav from "../../components/CommunityBottomNav";
import InstagramGallery from "../../components/InstagramGallery";
import ProfileButton from "../../components/ProfileButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CommunityInstagramPage() {
  const threeDaysAgo = new Date(
    Date.now() - 3 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: instagramPosts, error } = await supabase
    .from("business_instagram_posts")
    .select(`
      id,
      stored_image_url,
      instagram_post_url,
      caption,
      posted_at,
      business:businesses(
        id,
        name
      )
    `)
    .eq("status", "active")
    .not("stored_image_url", "is", null)
    .not("instagram_post_url", "is", null)
    .not("posted_at", "is", null)
    .gte("posted_at", threeDaysAgo)
    .order("posted_at", {
      ascending: false,
      nullsFirst: false,
    });

  if (error) {
    console.error("community instagram page error:", error);
  }

  const latestPosts = Array.from(
    new Map(
      (instagramPosts ?? []).map((post: any) => {
        const business = Array.isArray(post.business)
          ? post.business[0]
          : post.business;

        return [
          business?.id ?? post.id,
          {
            ...post,
            business,
          },
        ];
      }),
    ).values(),
  );

  return (
    <main className="min-h-screen bg-[#F8F3EC] text-[#172033]">
      <header className="sticky top-0 z-40 border-b border-[#E7DED3] bg-[#F8F3EC]/95 backdrop-blur">
        <div className="relative mx-auto flex h-16 max-w-xl items-center justify-between px-4">
          <Link
            href="/community"
            aria-label="Back to Community"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#D8CEC1] bg-white text-[24px] font-bold text-[#172033] shadow-sm transition active:scale-95"
          >
            ‹
          </Link>

          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
            <h1 className="whitespace-nowrap text-[16px] font-extrabold leading-tight text-[#172033]">
              Today&apos;s Instagram
            </h1>
            <p className="mt-0.5 whitespace-nowrap text-[10px] font-semibold text-gray-500">
              오늘의 인스타그램
            </p>
          </div>

          <div className="flex h-10 w-10 items-center justify-center">
            <ProfileButton />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-xl px-4 pb-28 pt-5">
        <InstagramGallery posts={latestPosts as any[]} />
      </section>

      <CommunityBottomNav activeNav="community" />
    </main>
  );
}