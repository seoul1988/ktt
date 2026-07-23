"use client";

import { useState } from "react";

type AdActionButtonsProps = {
  title: string;
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
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  textarea.style.opacity = "0";

  document.body.appendChild(textarea);

  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(
    0,
    textarea.value.length,
  );

  const copied =
    document.execCommand("copy");

  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error("복사 실패");
  }
}

export default function AdActionButtons({
  title,
  phone,
  directionUrl,
  websiteUrl,
}: AdActionButtonsProps) {
  const [copied, setCopied] =
    useState(false);

  const [shared, setShared] =
    useState(false);

  const hasPhone = Boolean(
    phone && phone.trim() !== "",
  );

  const hasDirection =
    Boolean(directionUrl);

  const hasWebsite =
    Boolean(websiteUrl);

  const primaryActionCount = [
    hasPhone,
    hasDirection,
    hasWebsite,
  ].filter(Boolean).length;

  const primaryGridClass =
    primaryActionCount === 1
      ? "grid-cols-1"
      : primaryActionCount === 2
        ? "grid-cols-2"
        : "grid-cols-3";

  function showTemporaryState(
    setter: (value: boolean) => void,
  ) {
    setter(true);

    window.setTimeout(() => {
      setter(false);
    }, 2000);
  }

  async function handleShare() {
    const currentPageUrl =
      window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text: title,
          url: currentPageUrl,
        });

        showTemporaryState(setShared);
        return;
      }

      await copyText(currentPageUrl);
      showTemporaryState(setShared);
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }

      console.error("공유 실패:", error);

      alert(
        "공유하지 못했습니다.",
      );
    }
  }

  async function handleCopyLink() {
    const currentPageUrl =
      window.location.href;

    try {
      await copyText(currentPageUrl);

      showTemporaryState(setCopied);
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
    <div className="mt-5 space-y-2">
      {primaryActionCount > 0 && (
        <div
          className={`grid gap-2 ${primaryGridClass}`}
        >
          {hasPhone && phone && (
            <a
              href={`tel:${cleanPhone(phone)}`}
              className="flex min-h-[56px] items-center justify-center rounded-2xl bg-green-600 px-2 py-3 text-center text-sm font-black text-white transition active:scale-[0.97]"
            >
              📞 전화하기
            </a>
          )}

          {hasDirection &&
            directionUrl && (
              <a
                href={directionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[56px] items-center justify-center rounded-2xl bg-orange-500 px-2 py-3 text-center text-sm font-black text-white transition active:scale-[0.97]"
              >
                🧭 길찾기
              </a>
            )}

          {hasWebsite &&
            websiteUrl && (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[56px] items-center justify-center rounded-2xl bg-blue-600 px-2 py-3 text-center text-sm font-black text-white transition active:scale-[0.97]"
              >
                🌐 웹사이트
              </a>
            )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleShare}
          className="flex min-h-[56px] items-center justify-center rounded-2xl bg-[#172033] px-2 py-3 text-center text-sm font-black text-white transition active:scale-[0.97]"
        >
          {shared
            ? "✅ 공유 완료"
            : "📤 공유하기"}
        </button>

        <button
          type="button"
          onClick={handleCopyLink}
          className="flex min-h-[56px] items-center justify-center rounded-2xl bg-purple-600 px-2 py-3 text-center text-sm font-black text-white transition active:scale-[0.97]"
        >
          {copied
            ? "✅ 복사 완료"
            : "🔗 링크주소 복사"}
        </button>
      </div>
    </div>
  );
}