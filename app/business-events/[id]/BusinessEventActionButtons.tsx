"use client";

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

export default function BusinessEventActionButtons({
  eventTitle,
  phone,
  address,
  latitude,
  longitude,
  registrationUrl,
}: Props) {
  const phoneHref = normalizePhone(phone);

  const directionsHref =
    typeof latitude === "number" && typeof longitude === "number"
      ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
      : address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
        : "";

  const shareText = `${eventTitle}${address ? `\n${address}` : ""}`;

  async function shareEvent() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: eventTitle,
          text: shareText,
          url: window.location.href,
        });
        return;
      }

      await navigator.clipboard.writeText(window.location.href);
      alert("Link copied.");
    } catch {
      // 사용자가 공유창을 닫은 경우 등은 별도 처리하지 않습니다.
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert("Link copied.");
    } catch {
      alert("Could not copy link.");
    }
  }

  const registrationHref = normalizeExternalUrl(registrationUrl);

  return (
    <div className="mt-5 space-y-2">
      {registrationHref && (
        <a
          href={registrationHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#172033] px-4 py-3 text-center text-sm font-black text-white shadow-sm"
        >
          Register / More Information
        </a>
      )}

      <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-black">
        {phoneHref ? (
          <a
            href={`tel:${phoneHref}`}
            className="flex min-h-[58px] flex-col items-center justify-center rounded-2xl border border-[#E2E4E7] bg-white px-2 py-2 text-[#172033] shadow-sm"
          >
            <div className="text-lg">☎</div>
            <div>Call</div>
          </a>
        ) : (
          <div className="flex min-h-[58px] flex-col items-center justify-center rounded-2xl border border-[#E2E4E7] bg-white px-2 py-2 text-gray-300 shadow-sm">
            <div className="text-lg">☎</div>
            <div>Call</div>
          </div>
        )}

        {directionsHref ? (
          <a
            href={directionsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[58px] flex-col items-center justify-center rounded-2xl border border-[#E2E4E7] bg-white px-2 py-2 text-[#172033] shadow-sm"
          >
            <div className="text-lg">⌖</div>
            <div>Directions</div>
          </a>
        ) : (
          <div className="flex min-h-[58px] flex-col items-center justify-center rounded-2xl border border-[#E2E4E7] bg-white px-2 py-2 text-gray-300 shadow-sm">
            <div className="text-lg">⌖</div>
            <div>Directions</div>
          </div>
        )}

        <button
          type="button"
          onClick={shareEvent}
          className="flex min-h-[58px] flex-col items-center justify-center rounded-2xl border border-[#E2E4E7] bg-white px-2 py-2 text-[#172033] shadow-sm"
        >
          <div className="text-lg">↗</div>
          <div>Share</div>
        </button>

        <button
          type="button"
          onClick={copyLink}
          className="flex min-h-[58px] flex-col items-center justify-center rounded-2xl border border-[#E2E4E7] bg-white px-2 py-2 text-[#172033] shadow-sm"
        >
          <div className="text-lg">⧉</div>
          <div>Copy Link</div>
        </button>
      </div>
    </div>
  );
}