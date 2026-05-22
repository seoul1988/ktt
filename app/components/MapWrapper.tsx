"use client";

import dynamic from "next/dynamic";

const BusinessMap = dynamic(() => import("./BusinessMap"), {
  ssr: false,
});

export default function MapWrapper({ spots }: { spots: any[] }) {
  return <BusinessMap spots={spots} />;
}