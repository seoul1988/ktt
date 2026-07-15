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
      className={
        `fixed top-0 right-0 z-50 flex h-11 w-11 flex-col items-center justify-center rounded-full border shadow-lg transition active:scale-95 ${
          isActive
            ? "border-red-700 bg-red-700 text-white"
            : "border-red-600 bg-red-600 text-white hover:bg-red-700"
        }`
      }
    >
      <span className="text-base leading-none">📖</span>
      <span className="mt-0.5 text-[8px] font-black leading-none">
        광고
      </span>
    </Link>
  );
}
