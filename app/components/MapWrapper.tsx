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

type MapWrapperProps = {
  spots: any[];
  showAllOnLoad?: boolean;
  activeNav?: "map" | "deals";
  communityMode?: boolean;
};

export default function MapWrapper({
  spots,
  showAllOnLoad = false,
  activeNav = "map",
  communityMode = false,
}: MapWrapperProps) {
  return (
    <BusinessMap
      spots={spots}
      showAllOnLoad={showAllOnLoad}
      activeNav={activeNav}
      communityMode={communityMode}
    />
  );
}