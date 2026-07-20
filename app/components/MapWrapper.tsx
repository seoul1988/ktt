"use client";

import dynamic from "next/dynamic";

const BusinessMap = dynamic(() => import("./BusinessMap"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#F8F3EC] text-sm font-bold text-[#172033]">
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
  markerSpots?: any[];
  categories?: MapCategory[];
  showAllOnLoad?: boolean;
  activeNav?:
    | "home"
    | "map"
    | "deals"
    | "events"
    | "community"
    | "admin";
  communityMode?: boolean;
  role?: string | null;
  initialCategory?: string;
};

export default function MapWrapper({
  spots,
  markerSpots,
  categories = [],
  showAllOnLoad = false,
  activeNav = "map",
  communityMode = false,
  role = null,
  initialCategory = "",
}: MapWrapperProps) {
  return (
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
  );
}