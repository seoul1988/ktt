"use client";

import Link from "next/link";

export default function InquiryTab() {
  return (
    <Link
      href="/community/inquiries"
      className="fixed right-0 top-1/2 z-50 -translate-y-1/2 rounded-l-2xl bg-[#C4483A] px-3 py-5 text-sm font-black text-white shadow-xl transition hover:bg-[#A9382D]"
      style={{ writingMode: "vertical-rl" }}
    >
      문의하기
    </Link>
  );
}