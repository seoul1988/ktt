"use client";

import { useMemo, useState } from "react";

type Props = {
  eventTitle: string;
  phone?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  registrationUrl?: string | null;
};

function normalizeExternalUrl(value: string | null | undefined) {
  const trimmed = String(value || "").trim();

  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function normalizePhone(value: string | null | undefined) {
  return String(value || "").replace(/[^\d+]/g, "");
}

function PhoneIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.7 3.8 9 3.2a1.5 1.5 0 0 1 1.7.8l1.2 2.8a1.5 1.5 0 0 1-.4 1.7l-1.3 1.1a13.2 13.2 0 0 0 4.2 4.2l1.1-1.3a1.5 1.5 0 0 1 1.7-.4l2.8 1.2a1.5 1.5 0 0 1 .8 1.7l-.6 2.3a2.8 2.8 0 0 1-2.7 2.1C10.4 19.4 4.6 13.6 4.6 6.5a2.8 2.8 0 0 1 2.1-2.7Z"
      />
    </svg>
  );
}

function DirectionsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z"
      />

      <circle cx="12" cy="10" r="2.1" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="2.2" />
      <circle cx="6" cy="12" r="2.2" />
      <circle cx="18" cy="19" r="2.2" />

      <path
        strokeLinecap="round"
        d="m8 11 7.8-4.6M8 13l7.8 4.6"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <rect
        x="8"
        y="8"
        width="11"
        height="11"
        rx="2"
      />

      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"
      />
    </svg>
  );
}

function RegisterIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <circle cx="12" cy="7.5" r="3.2" />

      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5.5 20c.5-4 2.7-6.2 6.5-6.2s6 2.2 6.5 6.2"
      />
    </svg>
  );
}

export default function CommunityEventActionButtons({
  eventTitle,
  phone,
  address,
  latitude,
  longitude,
  registrationUrl,
}: Props) {
  const [copied, setCopied] = useState(false);

  const cleanPhone = normalizePhone(phone);
  const cleanRegistrationUrl =
    normalizeExternalUrl(registrationUrl);
  const cleanAddress = String(address || "").trim();

  const hasCoordinates =
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    typeof longitude === "number" &&
    Number.isFinite(longitude);

  const directionsUrl = hasCoordinates
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        `${latitude},${longitude}`,
      )}`
    : cleanAddress
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
          cleanAddress,
        )}`
      : "";

  const visibleCount = useMemo(() => {
    return (
      2 +
      (cleanPhone ? 1 : 0) +
      (directionsUrl ? 1 : 0) +
      (cleanRegistrationUrl ? 1 : 0)
    );
  }, [
    cleanPhone,
    directionsUrl,
    cleanRegistrationUrl,
  ]);

  const gridClass =
    visibleCount >= 5
      ? "grid-cols-5"
      : visibleCount === 4
        ? "grid-cols-4"
        : visibleCount === 3
          ? "grid-cols-3"
          : "grid-cols-2";

  async function copyPageUrl() {
    const pageUrl = window.location.href;

    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      window.prompt(
        "아래 주소를 복사하세요.",
        pageUrl,
      );
    }
  }

  async function sharePage() {
    const pageUrl = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: eventTitle,
          text: eventTitle,
          url: pageUrl,
        });

        return;
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }
      }
    }

    await copyPageUrl();
  }

  const buttonClass =
    "flex min-w-0 min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl border border-[#D9DDE2] bg-white px-1 py-2 text-[#667085] shadow-sm transition hover:bg-[#F8F9FA] active:scale-[0.97]";

  const labelClass =
    "w-full truncate text-center text-[9px] font-bold leading-none text-[#344054] sm:text-[10px]";

  return (
    <div className={`mt-3 grid ${gridClass} gap-1.5`}>
      {cleanPhone && (
        <a
          href={`tel:${cleanPhone}`}
          className={buttonClass}
        >
          <PhoneIcon />

          <span className={labelClass}>
            전화
          </span>
        </a>
      )}

      {directionsUrl && (
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass}
        >
          <DirectionsIcon />

          <span className={labelClass}>
            길찾기
          </span>
        </a>
      )}

      <button
        type="button"
        onClick={sharePage}
        className={buttonClass}
      >
        <ShareIcon />

        <span className={labelClass}>
          공유
        </span>
      </button>

      <button
        type="button"
        onClick={copyPageUrl}
        className={buttonClass}
      >
        <CopyIcon />

        <span className={labelClass}>
          {copied ? "복사됨" : "링크복사"}
        </span>
      </button>

      {cleanRegistrationUrl && (
        <a
          href={cleanRegistrationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass}
        >
          <RegisterIcon />

          <span className={labelClass}>
            참가신청
          </span>
        </a>
      )}
    </div>
  );
}