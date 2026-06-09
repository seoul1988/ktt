"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const HIDE_KEY = "ktt_install_banner_hide_until";
const HIDE_TIME = 24 * 60 * 60 * 1000;

export default function InstallAppButton() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (standalone) {
      setIsInstalled(true);
      return;
    }

    const hideUntil = Number(localStorage.getItem(HIDE_KEY) || 0);
    const now = Date.now();

    if (now > hideUntil) {
      setShowBanner(true);
    }

    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  function closeBanner() {
    localStorage.setItem(HIDE_KEY, String(Date.now() + HIDE_TIME));
    setShowBanner(false);
  }

  async function installApp() {
    if (!installPrompt) return;

    await installPrompt.prompt();
    await installPrompt.userChoice;

    setInstallPrompt(null);
    setShowBanner(false);
  }

  if (isInstalled) return null;

  return (
    <>
      {showBanner && (
        <div className="fixed left-4 right-4 top-4 z-[99999] rounded-3xl bg-[#172033] p-4 text-white shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black">Install KTown Triangle</p>
              <p className="mt-1 text-xs font-semibold text-white/75">
                Add this app to your phone for faster access.
              </p>
            </div>

            <button
              onClick={closeBanner}
              className="rounded-full bg-white/15 px-3 py-1 text-xs font-black"
            >
              ✕
            </button>
          </div>

          <button
            onClick={installApp}
            className="mt-4 w-full rounded-2xl bg-[#F7B955] py-3 text-sm font-black text-[#172033]"
          >
            Install App
          </button>
        </div>
      )}

      {!showBanner && (
        <button
          onClick={() => setShowBanner(true)}
          className="fixed right-4 top-24 z-[99999] rounded-full bg-[#172033] px-4 py-3 text-xs font-black text-white shadow-2xl"
        >
          APP
        </button>
      )}
    </>
  );
}