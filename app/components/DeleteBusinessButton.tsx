"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "../../lib/supabase";

type Props = {
  businessId: string;
  businessName: string;
  redirectHref?: string;
};

export default function DeleteBusinessButton({
  businessId,
  businessName,
  redirectHref = "/map",
}: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  function closeModal() {
    if (isDeleting) return;

    setIsOpen(false);
    setErrorMessage("");
  }

  async function handleDelete() {
    if (isDeleting) return;

    setIsDeleting(true);
    setErrorMessage("");

    const { error } = await supabase
      .from("businesses")
      .delete()
      .eq("id", businessId);

    if (error) {
      console.error("Business delete error:", error);
      setErrorMessage(
        error.message || "삭제하지 못했습니다. 다시 시도해 주세요.",
      );
      setIsDeleting(false);
      return;
    }

    setIsOpen(false);
    router.replace(redirectHref);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded bg-red-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-red-700 active:scale-95"
      >
        Delete
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 px-5 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-business-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="px-6 pb-5 pt-7 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl">
                ⚠️
              </div>

              <h2
                id="delete-business-title"
                className="mt-4 text-xl font-black text-[#172033]"
              >
                Are you sure?
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-600">
                <span className="font-bold text-[#172033]">
                  {businessName}
                </span>
                을(를) 삭제하시겠습니까?
                <br />
                삭제한 정보는 복구할 수 없습니다.
              </p>

              {errorMessage && (
                <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
                  {errorMessage}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 border-t border-gray-200">
              <button
                type="button"
                onClick={closeModal}
                disabled={isDeleting}
                className="min-h-14 border-r border-gray-200 bg-white px-4 text-sm font-extrabold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="min-h-14 bg-red-600 px-4 text-sm font-extrabold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-400"
              >
                {isDeleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}