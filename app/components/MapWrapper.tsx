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
  initialCategory?: string;
};

export default function MapWrapper({
  spots,
  categories = [],
  showAllOnLoad = false,
  activeNav = "map",
  communityMode = false,
  role = null,
  initialCategory = "",
}: MapWrapperProps) {
  /*
   * 카드 목록에는 전체 spots를 그대로 사용합니다.
   *
   * page.tsx에서 show_marker가 false로 지정된 항목만
   * 지도 마커 목록에서 제외합니다.
   */
  const markerSpots = spots.filter(
    (spot) => spot.show_marker !== false
  );

  const mapKey = `${activeNav}-${
    communityMode ? "community" : "business"
  }-${spots
    .map(
      (spot) =>
        spot.map_key ||
        `${spot.type}-${spot.id}`
    )
    .join("-")}-${initialCategory}`;

  return (
    <div key={mapKey} className="min-h-screen">
      <BusinessMap
        spots={spots}
        markerSpots={markerSpots}
        categories={categories}
        showAllOnLoad={showAllOnLoad}
        activeNav={activeNav}
        communityMode={communityMode}
        role={role}
        initialCategory={initialCategory}
      />
    </div>
  );
}