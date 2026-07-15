"use client";

import Link from "next/link";

export default function InquiryTab() {
  return (
    <Link
      href="/community/inquiries"
      aria-label="문의하기"
      className="
        fixed
        right-0
        top-1/2
        z-50
        flex
        h-10
        w-5
        -translate-y-1/2
        items-center
        justify-center
        rounded-l-xl
        bg-[#C4483A]
        text-white
        shadow-lg
        transition-all
        duration-300
        hover:w-9
      "
    >
      <span
        className="text-[10px] font-black leading-none"
        style={{ writingMode: "vertical-rl" }}
      >
        문의
      </span>
    </Link>
  );
}