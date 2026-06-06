"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallAppButton() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  function closeBanner() {
    setIsClosing(true);

    window.setTimeout(() => {
      setShowBanner(false);
      setIsClosing(false);
    }, 350);
  }

  function openBanner() {
    setShowBanner(true);
    setIsClosing(false);
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

    const timer = window.setTimeout(() => {
      closeBanner();
    }, 5000);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) {
      setShowIOSGuide(true);
      return;
    }

    await installPrompt.prompt();

    const choice = await installPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setIsInstalled(true);
    }

    setInstallPrompt(null);
  }

  function handleTouchEnd(x: number) {
    if (touchStartX !== null && x - touchStartX > 80) {
      closeBanner();
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
          onTouchEnd={(e) => handleTouchEnd(e.changedTouches[0].clientX)}
          className={`fixed left-6 right-6 top-[82px] z-[2000] rounded-3xl bg-[#EFE3D3] p-4 shadow-2xl transition-transform duration-300 ease-in-out ${
            isClosing ? "translate-x-[120%]" : "translate-x-0"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-sm font-black text-[#172033]">
                📱 Add KTown to your phone
              </p>

              <p className="mt-1 text-xs font-semibold text-[#6B6257]">
                Quick access to local Korean food, events, and deals.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={installApp}
                className="shrink-0 rounded-full bg-[#172033] px-4 py-2 text-xs font-black text-white"
              >
                Add
              </button>

              <button
                onClick={closeBanner}
                className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-black text-[#6B6257] hover:bg-black/5"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={openBanner}
          className="fixed right-0 top-1/2 z-[2000] h-20 w-4 -translate-y-1/2 rounded-l-full bg-[#A8A8A8] shadow-md"
          aria-label="Open install panel"
        >
          <span className="block text-center text-[10px] text-white">≡</span>
        </button>
      )}

      {showIOSGuide && (
        <div className="fixed inset-0 z-[3000] flex items-end bg-black/40 p-4">
          <div className="w-full rounded-[28px] bg-white p-5 text-[#172033] shadow-2xl">
            <h2 className="text-xl font-black">Add KTown to your phone</h2>

            <div className="mt-4 space-y-3 text-sm font-semibold text-gray-700">
              <p>1. Open the browser menu.</p>
              <p>2. Tap “Add to Home screen”.</p>
              <p>3. Tap “Add”.</p>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full rounded-2xl bg-[#172033] py-3 font-black text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}