"use client";

import { useRef, useState } from "react";

type AdActionButtonsProps = {
  title: string;
  phone: string | null;
  directionUrl: string | null;
  websiteUrl: string | null;
};

type IconProps = {
  className?: string;
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

function PhoneIcon({
  className = "h-[21px] w-[21px]",
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function NavigationIcon({
  className = "h-[21px] w-[21px]",
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 11 22 2l-9 19-2-8-8-2Z" />
    </svg>
  );
}

function GlobeIcon({
  className = "h-[21px] w-[21px]",
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

function ShareIcon({
  className = "h-[21px] w-[21px]",
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.2 10.8 7.6-4.5" />
      <path d="m8.2 13.2 7.6 4.5" />
    </svg>
  );
}

function LinkIcon({
  className = "h-[21px] w-[21px]",
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function CheckIcon({
  className = "h-[21px] w-[21px]",
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

export default function AdActionButtons({
  title,
  phone,
  directionUrl,
  websiteUrl,
}: AdActionButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const copiedTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );

  const sharedTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );

  const hasPhone = Boolean(
    phone && phone.trim() !== "",
  );

  const hasDirection = Boolean(directionUrl);
  const hasWebsite = Boolean(websiteUrl);

  const iconButtonClass =
    "flex h-10 w-10 shrink-0 items-center justify-center text-[#657083] transition hover:text-[#172033] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#172033]/20 active:scale-90";

  function showCopiedState() {
    setCopied(true);

    if (copiedTimerRef.current) {
      clearTimeout(copiedTimerRef.current);
    }

    copiedTimerRef.current = setTimeout(() => {
      setCopied(false);
    }, 1800);
  }

  function showSharedState() {
    setShared(true);

    if (sharedTimerRef.current) {
      clearTimeout(sharedTimerRef.current);
    }

    sharedTimerRef.current = setTimeout(() => {
      setShared(false);
    }, 1800);
  }

  async function handleShare() {
    const pageUrl = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text: title,
          url: pageUrl,
        });

        showSharedState();
        return;
      }

      await copyText(pageUrl);
      showSharedState();
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
    const pageUrl = window.location.href;

    try {
      await copyText(pageUrl);
      showCopiedState();
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
    <div className="mt-4">
      <div className="flex items-center justify-center gap-4">
        {hasPhone && phone && (
          <a
            href={`tel:${cleanPhone(phone)}`}
            className={iconButtonClass}
            aria-label="전화하기"
            title="전화하기"
          >
            <PhoneIcon />
          </a>
        )}

        {hasDirection && directionUrl && (
          <a
            href={directionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={iconButtonClass}
            aria-label="길찾기"
            title="길찾기"
          >
            <NavigationIcon />
          </a>
        )}

        {hasWebsite && websiteUrl && (
          <a
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={iconButtonClass}
            aria-label="웹사이트 방문"
            title="웹사이트 방문"
          >
            <GlobeIcon />
          </a>
        )}

        <button
          type="button"
          onClick={handleShare}
          className={iconButtonClass}
          aria-label={
            shared ? "공유 완료" : "공유하기"
          }
          title={
            shared ? "공유 완료" : "공유하기"
          }
        >
          {shared ? (
            <CheckIcon />
          ) : (
            <ShareIcon />
          )}
        </button>

        <button
          type="button"
          onClick={handleCopyLink}
          className={iconButtonClass}
          aria-label={
            copied
              ? "링크주소 복사 완료"
              : "링크주소 복사"
          }
          title={
            copied
              ? "복사 완료"
              : "링크주소 복사"
          }
        >
          {copied ? (
            <CheckIcon />
          ) : (
            <LinkIcon />
          )}
        </button>
      </div>

      {(copied || shared) && (
        <p
          className="mt-1 text-center text-[10px] font-medium text-gray-400"
          aria-live="polite"
        >
          {copied
            ? "링크주소가 복사되었습니다."
            : "공유가 완료되었습니다."}
        </p>
      )}
    </div>
  );
}