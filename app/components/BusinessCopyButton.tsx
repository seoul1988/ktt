"use client";

import { useState } from "react";

export default function BusinessCopyButton() {
  const [copied, setCopied] = useState(false);

  async function copyCurrentUrl() {
    const currentUrl = window.location.href;

    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch {
      window.prompt("아래 주소를 복사하세요.", currentUrl);
    }
  }

  return (
    <button
      type="button"
      onClick={copyCurrentUrl}
      aria-label="Copy business page address"
      className="flex min-w-0 flex-col items-center justify-start gap-1 active:scale-95"
    >
      <span className="flex h-8 items-center justify-center text-2xl leading-none">
        📋
      </span>

      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}