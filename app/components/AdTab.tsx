"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdTab() {
  const pathname = usePathname();
  const isActive = pathname.startsWith("/community/ads");

  return (
    <Link
      href="/community/ads"
      aria-label="광고 책자 보기"
      className={`fixed right-4 z-50 flex h-14 w-14 flex-col items-center justify-center rounded-full border shadow-xl transition active:scale-95 ${
        isActive
          ? "border-[#172033] bg-[#172033] text-white"
          : "border-[#E7D8C7] bg-white text-[#172033]"
      }`}
      style={{ bottom: "calc(6.1rem + env(safe-area-inset-bottom))" }}
    >
      <span className="text-xl leading-none">📖</span>
      <span className="mt-0.5 text-[9px] font-black">광고</span>
    </Link>
  );
}