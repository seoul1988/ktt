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
  const [showIOSGuide, setShowIOSGuide] = useState(false);

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
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) return;

    await installPrompt.prompt();

    const choice = await installPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setIsInstalled(true);
    }

    setInstallPrompt(null);
  }

  if (isInstalled) return null;

  if (!installPrompt && !isIOS) return null;

  return (
    <>
      <div className="fixed left-4 right-4 top-[82px] z-[2000] rounded-3xl bg-white p-4 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-[#172033]">
              📱 Install KTown Triangle
            </p>
            <p className="mt-1 text-xs font-semibold text-gray-500">
              Open faster from your home screen.
            </p>
          </div>

          {installPrompt ? (
            <button
              onClick={installApp}
              className="shrink-0 rounded-full bg-[#172033] px-4 py-2 text-xs font-black text-white"
            >
              Install
            </button>
          ) : (
            <button
              onClick={() => setShowIOSGuide(true)}
              className="shrink-0 rounded-full bg-[#172033] px-4 py-2 text-xs font-black text-white"
            >
              How
            </button>
          )}
        </div>
      </div>

      {showIOSGuide && (
        <div className="fixed inset-0 z-[3000] flex items-end bg-black/40 p-4">
          <div className="w-full rounded-[28px] bg-white p-5 text-[#172033] shadow-2xl">
            <h2 className="text-xl font-black">Install on iPhone</h2>

            <div className="mt-4 space-y-3 text-sm font-semibold text-gray-700">
              <p>1. Tap the Share button in Safari.</p>
              <p>2. Select “Add to Home Screen”.</p>
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