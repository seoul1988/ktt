// app/community/map/page.tsx

import { supabase } from "../../../lib/supabase";
import CommunityBottomNav from "../../components/CommunityBottomNav";
import MapWrapper from "../../components/MapWrapper";

export default async function CommunityMapPage() {
  const { data: marketplaceItems } = await supabase
    .from("marketplace_items")
    .select("*")
    .eq("sold", false)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .order("created_at", { ascending: false });

  const spots =
    marketplaceItems?.map((item) => ({
      ...item,
      id: item.id,
      name: item.title,
      category: "Marketplace",
      emoji: "🛍️",
      image_url: item.image_urls?.[0] || null,
      price: item.price,
      type: "marketplace",
    })) || [];

  return (
    <main className="relative min-h-screen bg-[#F8F3EC]">
      <MapWrapper
        spots={spots}
        showAllOnLoad={true}
        activeNav="map"
        communityMode={true}
      />

      <CommunityBottomNav />
    </main>
  );
}