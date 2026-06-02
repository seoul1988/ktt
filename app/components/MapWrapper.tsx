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
  const mapKey = `${activeNav}-${communityMode ? "community" : "business"}-${spots.length}`;

  return (
    <div key={mapKey} className="min-h-screen">
      <BusinessMap
        spots={spots}
        categories={categories}
        showAllOnLoad={showAllOnLoad}
        activeNav={activeNav}
        communityMode={communityMode}
        role={role}
      />
    </div>
  );
}