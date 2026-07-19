"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const HIDE_KEY = "ktt_install_banner_hide_until";
const HIDE_TIME = 24 * 60 * 60 * 1000;
const AUTO_HIDE_TIME = 5000;

export default function InstallAppButton() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  function hideFor24Hours() {
    localStorage.setItem(HIDE_KEY, String(Date.now() + HIDE_TIME));
  }

  function hideBanner(save24Hours = false) {
    setIsClosing(true);

    if (save24Hours) {
      hideFor24Hours();
    }

    window.setTimeout(() => {
      setShowBanner(false);
      setIsClosing(false);
    }, 350);
  }

  function openBanner() {
    setShowBanner(true);
    setIsClosing(false);
  }

  function shouldShowBanner() {
    const hideUntil = Number(localStorage.getItem(HIDE_KEY) || 0);
    return Date.now() > hideUntil;
  }

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (standalone) {
      setIsInstalled(true);
      return;
    }

    const userAgent = window.navigator.userAgent.toLowerCase();

    const ios =
      /iphone|ipad|ipod/.test(userAgent) &&
      !(window.navigator as any).standalone;

    setIsIOS(ios);

    let autoTimer: number | null = null;

    function showThenAutoHide() {
      if (!shouldShowBanner()) return;

      setShowBanner(true);
      setIsClosing(false);

      if (autoTimer) {
        window.clearTimeout(autoTimer);
      }

      autoTimer = window.setTimeout(() => {
        hideBanner(true);
      }, AUTO_HIDE_TIME);
    }

    if (ios) {
      showThenAutoHide();
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      showThenAutoHide();
    }

    function handleAppInstalled() {
      setIsInstalled(true);
      setInstallPrompt(null);
      setShowBanner(false);
    }

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt,
    );
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      if (autoTimer) {
        window.clearTimeout(autoTimer);
      }

      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!showIOSGuide) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showIOSGuide]);

  async function installApp() {
    if (!installPrompt) {
      setShowIOSGuide(true);
      hideFor24Hours();
      setShowBanner(false);
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setIsInstalled(true);
    }

    setInstallPrompt(null);
    hideFor24Hours();
    setShowBanner(false);
  }

  function handleTouchEnd(x: number) {
    if (touchStartX !== null && x - touchStartX > 80) {
      hideBanner(true);
    }

    setTouchStartX(null);
  }

  if (isInstalled) return null;
  if (!installPrompt && !isIOS) return null;

  return (
    <>
      {showBanner ? (
        <div
          onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
          onTouchEnd={(e) =>
            handleTouchEnd(e.changedTouches[0].clientX)
          }
          className={`fixed left-4 right-4 top-4 z-[99999] rounded-3xl bg-[#172033] p-4 text-white shadow-2xl transition-transform duration-300 ease-in-out ${
            isClosing ? "translate-x-[120%]" : "translate-x-0"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-sm font-black">
                📱 Install KTown Triangle
              </p>

              <p className="mt-1 text-xs font-semibold text-white/75">
                Add this app to your phone for faster access.
              </p>
            </div>

            <button
              type="button"
              onClick={() => hideBanner(true)}
              className="rounded-full bg-white/15 px-3 py-1 text-xs font-black"
              aria-label="Close install banner"
            >
              ✕
            </button>
          </div>

          <button
            type="button"
            onClick={installApp}
            className="mt-4 w-full rounded-2xl bg-[#F7B955] py-3 text-sm font-black text-[#172033]"
          >
            Install App
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={openBanner}
          className="fixed right-0 top-1/2 z-[2000] h-20 w-8 -translate-y-1/2 rounded-l-full bg-[#A8A8A8] shadow-md"
          aria-label="Open install panel"
        >
          <span className="block text-center text-[10px] text-white">
            ≡
          </span>
        </button>
      )}

      {showIOSGuide && (
        <div
          className="fixed inset-0 z-[100000] flex items-end justify-center bg-black/60 p-3 backdrop-blur-[2px] sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-install-guide-title"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] bg-white text-[#172033] shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-6">
              <div>
                <h2
                  id="ios-install-guide-title"
                  className="text-lg font-black sm:text-xl"
                >
                  Install KTown Triangle
                </h2>

                <p className="mt-1 text-xs font-semibold text-gray-500 sm:text-sm">
                  Follow the image below to add KTown Triangle to your iPhone Home Screen.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-lg font-black text-gray-600"
                aria-label="Close installation guide"
              >
                ✕
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-[#F8F9FB] p-2 sm:p-4">
              <div className="mx-auto overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <img
                  src="/images/ios-install-guide.png"
                  alt="How to add KTownTriangle.com to the iPhone Home Screen"
                  className="h-auto w-full"
                  loading="eager"
                  decoding="async"
                />
              </div>
            </div>

            <div className="border-t border-gray-200 bg-white p-4 sm:px-6">
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-2xl bg-[#172033] py-3 text-sm font-black text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}