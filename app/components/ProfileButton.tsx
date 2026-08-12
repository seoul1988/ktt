"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ProfileButton from "@/app/components/ProfileButton";

export default function CommunityHeader() {
  const pathname = usePathname();

  const isCommunityPage =
    pathname === "/community" ||
    pathname.startsWith("/community/");

  return (
    <div className="relative flex min-h-[56px] w-full items-center border-b border-[#E9DED0] bg-white px-3">
      <Link
        href="/community"
        className="relative z-10 flex h-9 w-9 items-center justify-center text-xl font-bold text-[#172033]"
        aria-label="Back"
      >
        ‹
      </Link>

      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
        <div className="whitespace-nowrap text-[16px] font-black text-[#172033]">
          Community
        </div>
      </div>

      <div className="absolute right-2 top-1/2 z-20 flex -translate-y-1/2 items-center gap-1.5">
        {isCommunityPage && (
          <Link
            href="/community/manual"
            className="inline-flex h-7 items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-[#E8DED1] bg-white px-2 text-[10px] font-black text-[#172033] shadow-sm active:scale-95"
            aria-label="Open user guide"
          >
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#172033] text-[9px] font-black leading-none text-white">
              ?
            </span>

            <span>Guide</span>
          </Link>
        )}

        <ProfileButton />
      </div>
    </div>
  );
}