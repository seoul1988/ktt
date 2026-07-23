"use client";

import { useEffect, useState } from "react";

type AdActionButtonsProps = {
  title: string;
  phone?: string | null;
  directionUrl?: string | null;
};

function cleanPhone(phone: string) {
  return phone.replace(/[^\d+]/g, "");
}

export default function AdActionButtons({
  title,
  phone,
  directionUrl,
}: AdActionButtonsProps) {
  const [currentUrl, setCurrentUrl] = useState("");
  const [shared, setShared] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    setCurrentUrl(window.location.href);
  }, []);

  const cleanPhoneNumber =
    typeof phone === "string" && phone.trim() !== ""
      ? cleanPhone(phone)
      : null;

  const hasPhone = Boolean(cleanPhoneNumber);
  const hasDirection = Boolean(directionUrl);

  const actionCount = [
    hasPhone,
    hasDirection,
    true,
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

  async function copyText(text: string) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");

    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const successful = document.execCommand("copy");

    document.body.removeChild(textarea);

    if (!successful) {
      throw new Error("Copy command failed");
    }
  }

  async function handleShare() {
    const pageUrl = currentUrl || window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text: title,
          url: pageUrl,
        });

        setShared(true);

        window.setTimeout(() => {
          setShared(false);
        }, 1800);

        return;
      }

      await copyText(pageUrl);

      setShared(true);

      window.setTimeout(() => {
        setShared(false);
      }, 1800);
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }

      console.error("공유 실패:", error);
      alert("공유하지 못했습니다.");
    }
  }

  async function handleCopyLink() {
    const pageUrl = currentUrl || window.location.href;

    try {
      await copyText(pageUrl);

      setLinkCopied(true);

      window.setTimeout(() => {
        setLinkCopied(false);
      }, 1800);
    } catch (error) {
      console.error("링크 복사 실패:", error);
      alert("링크 주소를 복사하지 못했습니다.");
    }
  }

  return (
    <div className={`mt-5 grid gap-2 ${gridClass}`}>
      {hasPhone && cleanPhoneNumber && (
        <a
          href={`tel:${cleanPhoneNumber}`}
          className="flex min-h-[76px] flex-col items-center justify-center rounded-2xl border border-green-100 bg-green-50 px-2 py-3 text-center transition active:scale-[0.97]"
        >
          <span className="text-2xl" aria-hidden="true">
            📞
          </span>

          <span className="mt-1 text-sm font-black text-green-700">
            전화하기
          </span>
        </a>
      )}

      {hasDirection && directionUrl && (
        <a
          href={directionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[76px] flex-col items-center justify-center rounded-2xl border border-orange-100 bg-orange-50 px-2 py-3 text-center transition active:scale-[0.97]"
        >
          <span className="text-2xl" aria-hidden="true">
            🧭
          </span>

          <span className="mt-1 text-sm font-black text-orange-700">
            길찾기
          </span>
        </a>
      )}

      <button
        type="button"
        onClick={handleShare}
        className="flex min-h-[76px] flex-col items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 px-2 py-3 text-center transition active:scale-[0.97]"
      >
        <span className="text-2xl" aria-hidden="true">
          📤
        </span>

        <span className="mt-1 text-sm font-black text-blue-700">
          {shared ? "공유 완료" : "공유하기"}
        </span>
      </button>

      <button
        type="button"
        onClick={handleCopyLink}
        className="flex min-h-[76px] flex-col items-center justify-center rounded-2xl border border-purple-100 bg-purple-50 px-2 py-3 text-center transition active:scale-[0.97]"
      >
        <span className="text-2xl" aria-hidden="true">
          🔗
        </span>

        <span className="mt-1 text-sm font-black text-purple-700">
          {linkCopied ? "복사 완료" : "링크주소 복사"}
        </span>
      </button>
    </div>
  );
}