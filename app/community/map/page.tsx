// app/community/map/page.tsx

import { supabase } from "../../../lib/supabase";
import CommunityBottomNav from "../../components/CommunityBottomNav";
import MapWrapper from "../../components/MapWrapper";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CommunityCategory = {
  name: string;
  emoji: string | null;
};

function normalizeCategory(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function splitCategories(value: string | null | undefined) {
  return String(value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export default async function CommunityMapPage() {
  const { data: communityCategories, error: categoryError } = await supabase
    .from("categories")
    .select("name, emoji")
    .eq("show_on_community_map", true)
    .order("name", { ascending: true });

  if (categoryError) {
    console.log("Community map categories load error:", categoryError);
  }

  const categoryList = (communityCategories || []) as CommunityCategory[];

  const allowedCategoryNames = new Set(
    categoryList.map((category) => normalizeCategory(category.name))
  );

  const categoryEmojiMap = new Map(
    categoryList.map((category) => [
      normalizeCategory(category.name),
      category.emoji,
    ])
  );

  const { data: businesses, error: businessError } = await supabase
    .from("businesses")
    .select("*")
    .not("lat", "is", null)
.not("lng", "is", null)
    .order("id", { ascending: true });

  if (businessError) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] p-5 text-[#172033]">
        <p className="font-bold text-red-600">
          커뮤니티 지도 불러오기 실패: {businessError.message}
        </p>
      </main>
    );
  }

  const { data: marketplaceItems, error: marketplaceError } = await supabase
    .from("marketplace_items")
    .select("*")
    .eq("sold", false)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .order("created_at", { ascending: false });

  if (marketplaceError) {
    console.log("Community marketplace load error:", marketplaceError);
  }

  const businessSpots =
    businesses?.flatMap((business: any) => {
      const rawCategories = splitCategories(
        business.category || business.categories || ""
      );

      return rawCategories
        .filter((cat) => allowedCategoryNames.has(normalizeCategory(cat)))
        .map((cat) => ({
		  ...business,
		  id: business.id, // 중요: 원래 business id 유지
		  original_id: business.id,
		  name: business.name,
		  category: cat,
		  emoji:
			categoryEmojiMap.get(normalizeCategory(cat)) ||
			business.emoji ||
			"📍",
		  image_url: business.image_url || business.logo_url || null,
		  lat: business.lat,
		  lng: business.lng,
		  type: "business",
		}));
    }) || [];

  const marketplaceSpots =
    marketplaceItems?.flatMap((item: any) => {
      const rawCategories = splitCategories(item.category || "Marketplace");

      return rawCategories
        .filter((cat) => allowedCategoryNames.has(normalizeCategory(cat)))
        .map((cat) => ({
          ...item,
          id: `marketplace-${item.id}-${normalizeCategory(cat)}`,
          original_id: item.id,
          name: item.title,
          category: cat,
          emoji: categoryEmojiMap.get(normalizeCategory(cat)) || "🛍️",
          image_url: item.image_urls?.[0] || null,
          lat: item.latitude,
          lng: item.longitude,
          price: item.price,
          type: "marketplace",
        }));
    }) || [];

  const spots = [...businessSpots, ...marketplaceSpots];

  return (
    <main className="relative min-h-screen bg-[#F8F3EC]">
      <MapWrapper
        spots={spots}
        categories={categoryList}
        showAllOnLoad={false}
        activeNav="map"
        communityMode={true}
      />

      <CommunityBottomNav  />
    </main>
  );
}