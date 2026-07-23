import { supabase } from "../../../lib/supabase";
import CommunityBottomNav from "../../components/CommunityBottomNav";
import InstagramGallery from "../../components/InstagramGallery";

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
      <section className="mx-auto max-w-xl px-4 pb-28 pt-5">
        <InstagramGallery posts={latestPosts as any[]} />
      </section>

      <CommunityBottomNav activeNav="community" />
    </main>
  );
}