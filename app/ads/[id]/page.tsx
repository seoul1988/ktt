"use client";

import { useEffect, useState } from "react";

type AdActionButtonsProps = {
  phone: string | null;
  directionUrl: string | null;
  websiteUrl: string | null;
};

function cleanPhone(phone: string) {
  return phone.replace(/[^\d+]/g, "");
}

async function copyText(text: string) {
  if (
    navigator.clipboard &&
    window.isSecureContext
  ) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea =
    document.createElement("textarea");

  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";

  document.body.appendChild(textarea);

  textarea.focus();
  textarea.select();

  const copied =
    document.execCommand("copy");

  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error("링크 복사 실패");
  }
}

export default function AdActionButtons({
  phone,
  directionUrl,
  websiteUrl,
}: AdActionButtonsProps) {
  const [pageUrl, setPageUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setPageUrl(window.location.href);
  }, []);

  const hasPhone = Boolean(
    phone && phone.trim() !== "",
  );

  const hasLocation = Boolean(directionUrl);
  const hasWebsite = Boolean(websiteUrl);

  const actionCount = [
    hasPhone,
    hasLocation,
    hasWebsite,
    true,
  ].filter(Boolean).length;

  const gridClass =
    actionCount === 1
      ? "grid-cols-1"
      : actionCount === 2
        ? "grid-cols-2"
        : actionCount === 3
          ? "grid-cols-3"
          : "grid-cols-2 sm:grid-cols-4";

  async function handleCopyLink() {
    const currentPageUrl =
      pageUrl || window.location.href;

    try {
      await copyText(currentPageUrl);

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error(
        "링크주소 복사 실패:",
        error,
      );

      alert(
        "링크주소를 복사하지 못했습니다.",
      );
    }
  }

  return (
    <div
      className={`mt-5 grid gap-2 ${gridClass}`}
    >
      {hasPhone && phone && (
        <a
          href={`tel:${cleanPhone(phone)}`}
          className="flex min-h-[54px] items-center justify-center rounded-2xl bg-green-600 px-2 py-3 text-center text-sm font-black text-white transition active:scale-[0.97]"
        >
          📞 전화하기
        </a>
      )}

      {hasLocation && directionUrl && (
        <a
          href={directionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[54px] items-center justify-center rounded-2xl bg-orange-500 px-2 py-3 text-center text-sm font-black text-white transition active:scale-[0.97]"
        >
          🧭 길찾기
        </a>
      )}

      {hasWebsite && websiteUrl && (
        <a
          href={websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[54px] items-center justify-center rounded-2xl bg-blue-600 px-2 py-3 text-center text-sm font-black text-white transition active:scale-[0.97]"
        >
          🌐 웹사이트
        </a>
      )}

      <button
        type="button"
        onClick={handleCopyLink}
        className="flex min-h-[54px] items-center justify-center rounded-2xl bg-purple-600 px-2 py-3 text-center text-sm font-black text-white transition active:scale-[0.97]"
      >
        {copied
          ? "✅ 복사 완료"
          : "🔗 링크주소 복사"}
      </button>
    </div>
  );
}