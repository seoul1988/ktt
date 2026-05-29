"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

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
  const [mapKey, setMapKey] = useState(0);

  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        setMapKey((prev) => prev + 1);
      }
    }

    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  return (
    <BusinessMap
      key={mapKey}
      spots={spots}
      showAllOnLoad={showAllOnLoad}
      activeNav={activeNav}
      communityMode={communityMode}
    />
  );
}