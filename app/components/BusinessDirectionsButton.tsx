"use client";

import { useState } from "react";

type BusinessDirectionsButtonProps = {
  businessName: string;
  address?: string | null;
  city?: string | null;
  isOpen: boolean;
};

export default function BusinessDirectionsButton({
  businessName,
  address,
  city,
  isOpen,
}: BusinessDirectionsButtonProps) {
  const [showClosedModal, setShowClosedModal] = useState(false);

  const destination =
    address?.trim() ||
    `${businessName} ${city || ""} NC`.trim();

  const directionsUrl =
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(destination);

  function continueToDirections() {
    setShowClosedModal(false);

    window.open(
      directionsUrl,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function handleDirectionsClick() {
    if (!isOpen) {
      setShowClosedModal(true);
      return;
    }

    continueToDirections();
  }

  return (
    <>
      <button
        type="button"
        onClick={handleDirectionsClick}
        aria-label={`Directions to ${businessName}`}
        className="flex min-w-0 flex-col items-center justify-start gap-1 active:scale-95"
      >
        <span className="flex h-8 items-center justify-center text-2xl leading-none">
          ↱
        </span>

        <span>Directions</span>
      </button>

      {showClosedModal && (
        <div
          role="presentation"
          onClick={() => setShowClosedModal(false)}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 px-5 backdrop-blur-[3px]"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="closed-business-title"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-[340px] rounded-[26px] bg-white p-5 text-center shadow-2xl"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-3xl">
              🕒
            </div>

            <h2
              id="closed-business-title"
              className="mt-4 text-[19px] font-extrabold text-[#172033]"
            >
              This business is currently closed
            </h2>

            <p className="mt-2 text-[13px] font-medium leading-6 text-gray-500">
              {businessName} is closed right now.
              <br />
              Do you still want directions?
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowClosedModal(false)}
                className="h-12 rounded-xl border border-gray-200 bg-white text-[14px] font-bold text-gray-600 transition active:scale-[0.98]"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={continueToDirections}
                className="h-12 rounded-xl bg-[#172033] text-[14px] font-bold text-white shadow-sm transition active:scale-[0.98]"
              >
                Continue
              </button>
            </div>

            <p className="mt-3 text-[10px] font-medium text-gray-400">
              Tap outside to close
            </p>
          </div>
        </div>
      )}
    </>
  );
}