// app/community/map/page.tsx

import { supabase } from "../../../lib/supabase";
import CommunityBottomNav from "../../components/CommunityBottomNav";
import MapWrapper from "../../components/MapWrapper";

type CommunityCategory = {
  name: string;
  emoji: string | null;
};

function normalizeCategory(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase();
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

  const spots =
    marketplaceItems
      ?.filter((item) => {
        const itemCategory = normalizeCategory(item.category || "Marketplace");

        if (allowedCategoryNames.size === 0) {
          return false;
        }

        return allowedCategoryNames.has(itemCategory);
      })
      .map((item) => ({
        ...item,
        id: item.id,
        name: item.title,
        category: item.category || "Marketplace",
        emoji: "🛍️",
        image_url: item.image_urls?.[0] || null,
        lat: item.latitude,
        lng: item.longitude,
        price: item.price,
        type: "marketplace",
      })) || [];

  return (
    <main className="relative min-h-screen bg-[#F8F3EC]">
      <MapWrapper
        spots={spots}
        categories={categoryList}
        showAllOnLoad={true}
        activeNav="map"
        communityMode={true}
      />

      <CommunityBottomNav />
    </main>
  );
}
