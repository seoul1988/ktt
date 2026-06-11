"use client";

import dynamic from "next/dynamic";

const BusinessMap = dynamic(() => import("./BusinessMap"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F3EC] text-sm font-bold text-[#172033]">
      Loading map...
    </div>
  ),
});

type MapCategory = {
  id?: number;
  name: string;
  emoji: string | null;
};

type MapWrapperProps = {
  spots: any[];
  categories?: MapCategory[];
  showAllOnLoad?: boolean;
  activeNav?: "map" | "deals" | "events";
  communityMode?: boolean;
  role?: string | null;
};

export default function MapWrapper({
  spots,
  categories = [],
  showAllOnLoad = false,
  activeNav = "map",
  communityMode = false,
  role = null,
}: MapWrapperProps) {
  const normalizedSpots =
    spots?.map((spot: any, index: number) => ({
      ...spot,
      map_key:
        spot.map_key ||
        `${spot.source_type || "business"}-${
          spot.deal_id || spot.event_id || spot.id || index
        }-${spot.business_id || spot.original_business_id || spot.id || index}`,
    })) || [];

  const mapKey = `${activeNav}-${communityMode ? "community" : "business"}-${
    normalizedSpots.length
  }`;

  return (
    <div key={mapKey} className="min-h-screen">
      <BusinessMap
        spots={normalizedSpots}
        categories={categories}
        showAllOnLoad={showAllOnLoad}
        activeNav={activeNav}
        communityMode={communityMode}
        role={role}
      />
    </div>
  );
}