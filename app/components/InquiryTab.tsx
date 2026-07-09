"use client";

import Link from "next/link";

export default function InquiryTab() {
  return (
    <Link
      href="/community/inquiries"
      className="
        fixed
        -right-6
        top-1/2
        z-50
        -translate-y-1/2
        rounded-l-xl
        bg-[#C4483A]
        px-1.5
        py-3
        text-[11px]
        font-bold
        text-white
        shadow-lg
        transition-all
        duration-300
        hover:right-0
      "
      style={{ writingMode: "vertical-rl" }}
    >
      문의
    </Link>
  );
}