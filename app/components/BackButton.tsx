"use client";

import { useRouter } from "next/navigation";

export default function BackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow hover:bg-gray-100"
      aria-label="뒤로가기"
    >
      ←
    </button>
  );
}