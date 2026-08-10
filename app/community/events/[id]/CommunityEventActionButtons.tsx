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
      strokeWidth="1.9"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.6 3.8 9 8.2 7.4 9.8c1.2 2.5 3.2 4.5 5.7 5.7l1.6-1.6 4.4 2.4c.4.2.6.7.5 1.1-.5 2-2.3 3.4-4.4 3.2C8.9 20 4 15.1 3.4 8.8 3.2 6.7 4.6 4.9 6.6 4.4c.4-.1.8.1 1 .4Z"
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
      strokeWidth="1.9"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z"
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
      strokeWidth="1.9"
      aria-hidden="true"
    >
      <circle cx="6" cy="12" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <circle cx="18" cy="18" r="2.2" />
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
      strokeWidth="1.9"
      aria-hidden="true"
    >
      <rect x="8" y="8" width="12" height="12" rx="2" />
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
      strokeWidth="1.9"
      aria-hidden="true"
    >
      <circle cx="9" cy="8" r="3" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.8 20c.5-4 2.3-6 5.2-6 1.4 0 2.6.5 3.5 1.4"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 13v6M14 16h6"
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
  const cleanRegistrationUrl = normalizeExternalUrl(registrationUrl);
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
  }, [cleanPhone, directionsUrl, cleanRegistrationUrl]);

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
      window.prompt("Copy the URL below.", pageUrl);
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
    "flex min-h-[58px] min-w-0 touch-manipulation flex-col items-center justify-center gap-1 rounded-xl border border-[#D9DDE2] bg-white px-1 py-2 text-[#667085] shadow-sm outline-none transition-[transform,background-color,border-color,box-shadow] duration-200 [-webkit-tap-highlight-color:transparent] hover:bg-[#F8F9FA] focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 active:scale-[0.97] active:bg-[#F1F3F5]";

  const registerButtonClass =
    "flex min-h-[58px] min-w-0 touch-manipulation flex-col items-center justify-center gap-1 rounded-xl border border-[#174EA6] bg-[#2563EB] px-1 py-2 text-white shadow-[0_3px_8px_rgba(37,99,235,0.22)] outline-none transition-[transform,background-color,box-shadow] duration-200 [-webkit-tap-highlight-color:transparent] hover:bg-[#1D4ED8] focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 active:scale-[0.97] active:bg-[#1E40AF] active:shadow-sm";

  const labelClass =
    "w-full truncate text-center text-[9px] font-bold leading-none text-[#344054] sm:text-[10px]";

  const registerLabelClass =
    "w-full truncate text-center text-[9px] font-black leading-none text-white sm:text-[10px]";

  return (
    <div className={`mt-3 grid ${gridClass} gap-1.5`}>
      {cleanPhone && (
        <a
          href={`tel:${cleanPhone}`}
          aria-label={`Call ${eventTitle}`}
          className={buttonClass}
        >
          <PhoneIcon />
          <span className={labelClass}>Call</span>
        </a>
      )}

      {directionsUrl && (
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Directions to ${eventTitle}`}
          className={buttonClass}
        >
          <DirectionsIcon />
          <span className={labelClass}>Directions</span>
        </a>
      )}

      <button
        type="button"
        onClick={sharePage}
        aria-label={`Share ${eventTitle}`}
        className={buttonClass}
      >
        <ShareIcon />
        <span className={labelClass}>Share</span>
      </button>

      <button
        type="button"
        onClick={copyPageUrl}
        aria-label={`Copy link for ${eventTitle}`}
        className={buttonClass}
      >
        <CopyIcon />
        <span className={labelClass}>
          {copied ? "Copied" : "Copy Link"}
        </span>
      </button>

      {cleanRegistrationUrl && (
        <a
          href={cleanRegistrationUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Register for ${eventTitle}`}
          className={registerButtonClass}
        >
          <RegisterIcon />
          <span className={registerLabelClass}>Register</span>
        </a>
      )}
    </div>
  );
}