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
    businesses
      ?.map((business: any) => {
        const businessId = Number(business.id);

        const rawCategories = splitCategories(
          business.category || business.categories || "Business"
        );

        const matchedCommunityCategories = rawCategories.filter((cat) =>
          allowedCategoryNames.has(normalizeCategory(cat))
        );

        const firstCategory =
          matchedCommunityCategories[0] || rawCategories[0] || "Business";

        const normalizedFirstCategory = normalizeCategory(firstCategory);

        return {
          ...business,

          id: businessId,
          business_id: businessId,
          original_business_id: businessId,
          original_id: businessId,

          name: business.name || "No business name",

          category: firstCategory,
          categories: rawCategories.join(", "),
          matched_categories: matchedCommunityCategories,

          emoji:
            categoryEmojiMap.get(normalizedFirstCategory) ||
            business.emoji ||
            "📍",

          image_url: business.image_url || business.logo_url || null,

          lat: Number(business.lat),
          lng: Number(business.lng),

          type: "business",
          source_type:
            matchedCommunityCategories.length > 0
              ? "community-business"
              : "business-search-only",

          community_visible: matchedCommunityCategories.length > 0,

          map_key: `community-business-${businessId}`,
        };
      })
      .filter((spot: any) => Number.isFinite(spot.lat) && Number.isFinite(spot.lng)) ||
    [];

  const uniqueBusinessSpots = Array.from(
    new Map(businessSpots.map((spot: any) => [spot.map_key, spot])).values()
  );

  const marketplaceSpots =
    marketplaceItems
      ?.map((item: any) => {
        const marketplaceId = Number(item.id);

        const rawCategories = splitCategories(item.category || "Marketplace");

        const matchedCategories = rawCategories.filter((cat) =>
          allowedCategoryNames.has(normalizeCategory(cat))
        );

        if (matchedCategories.length === 0) return null;

        const firstCategory = matchedCategories[0];
        const normalizedFirstCategory = normalizeCategory(firstCategory);

        return {
          ...item,

          id: marketplaceId,
          marketplace_id: marketplaceId,
          original_id: marketplaceId,

          business_id: `marketplace-${marketplaceId}`,
          original_business_id: `marketplace-${marketplaceId}`,

          name: item.title || "Marketplace Item",

          category: firstCategory,
          categories: matchedCategories.join(", "),
          matched_categories: matchedCategories,

          emoji: categoryEmojiMap.get(normalizedFirstCategory) || "🛍️",

          image_url: item.image_urls?.[0] || null,
          image_urls: item.image_urls || null,

          lat: Number(item.latitude),
          lng: Number(item.longitude),

          price: item.price,

          type: "marketplace",
          source_type: "marketplace",
          community_visible: true,

          map_key: `community-marketplace-${marketplaceId}`,
        };
      })
      .filter(
        (spot: any) =>
          spot &&
          Number.isFinite(spot.lat) &&
          Number.isFinite(spot.lng)
      ) || [];

  const spots = [...uniqueBusinessSpots, ...marketplaceSpots];

  return (
    <main className="relative min-h-screen bg-[#F8F3EC]">
      <MapWrapper
        spots={spots}
        categories={categoryList}
        showAllOnLoad={false}
        activeNav="map"
        communityMode={true}
      />

      <CommunityBottomNav activeNav="map" />
    </main>
  );
}