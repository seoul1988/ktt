"use client";

import { useEffect, useRef, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform?: string;
  }>;
};

type IOSNavigator = Navigator & {
  standalone?: boolean;
};

const HIDE_KEY = "ktt_install_banner_hide_until";
const HIDE_TIME = 24 * 60 * 60 * 1000;
const AUTO_HIDE_TIME = 5000;
const CLOSE_ANIMATION_TIME = 350;

export default function InstallAppButton() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [hasCheckedInstallState, setHasCheckedInstallState] =
    useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isPrompting, setIsPrompting] = useState(false);

  const autoHideTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  function clearAutoHideTimer() {
    if (autoHideTimerRef.current !== null) {
      window.clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
  }

  function clearCloseTimer() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function checkInstalledState() {
    const displayModeStandalone = window.matchMedia(
      "(display-mode: standalone)",
    ).matches;

    const iosStandalone =
      (window.navigator as IOSNavigator).standalone === true;

    const installed = displayModeStandalone || iosStandalone;

    setIsInstalled(installed);
    setHasCheckedInstallState(true);

    if (installed) {
      clearAutoHideTimer();
      clearCloseTimer();
      setInstallPrompt(null);
      setShowBanner(false);
      setShowIOSGuide(false);
      setIsClosing(false);
      setIsPrompting(false);
    }

    return installed;
  }

  function hideFor24Hours() {
    try {
      localStorage.setItem(HIDE_KEY, String(Date.now() + HIDE_TIME));
    } catch {
      // localStorage를 사용할 수 없는 브라우저에서는 무시합니다.
    }
  }

  function shouldShowBanner() {
    try {
      const hideUntil = Number(localStorage.getItem(HIDE_KEY) || 0);
      return Date.now() > hideUntil;
    } catch {
      return true;
    }
  }

  function hideBanner(save24Hours = false) {
    clearAutoHideTimer();
    clearCloseTimer();

    if (save24Hours) {
      hideFor24Hours();
    }

    setIsClosing(true);

    closeTimerRef.current = window.setTimeout(() => {
      setShowBanner(false);
      setIsClosing(false);
      closeTimerRef.current = null;
    }, CLOSE_ANIMATION_TIME);
  }

  function showBannerWithAutoHide() {
    if (checkInstalledState() || !shouldShowBanner()) return;

    clearAutoHideTimer();
    clearCloseTimer();
    setIsClosing(false);
    setShowBanner(true);

    autoHideTimerRef.current = window.setTimeout(() => {
      // 자동으로 닫힐 때는 24시간 숨기지 않습니다.
      hideBanner(false);
    }, AUTO_HIDE_TIME);
  }

  function openInstallGuide() {
    if (checkInstalledState()) return;

    clearAutoHideTimer();
    clearCloseTimer();
    setShowBanner(false);
    setIsClosing(false);

    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    setShowBrowserGuide(true);
  }

  async function openBanner() {
    if (checkInstalledState()) return;

    clearAutoHideTimer();
    clearCloseTimer();

    if (isIOS) {
      setShowIOSGuide(true);
      setShowBanner(false);
      setIsClosing(false);
      return;
    }

    if (!installPrompt) {
      // 브라우저가 아직 beforeinstallprompt를 제공하지 않은 상태입니다.
      // 가짜 안내창은 띄우지 않고 버튼만 그대로 둡니다.
      return;
    }

    await installApp();
  }

  useEffect(() => {
    const alreadyInstalled = checkInstalledState();
    if (alreadyInstalled) return;

    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDevice =
      /iphone|ipad|ipod/.test(userAgent) ||
      (window.navigator.platform === "MacIntel" &&
        window.navigator.maxTouchPoints > 1);

    const ios =
      iosDevice &&
      (window.navigator as IOSNavigator).standalone !== true;

    setIsIOS(ios);

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();

      if (checkInstalledState()) return;

      setInstallPrompt(event as BeforeInstallPromptEvent);
      showBannerWithAutoHide();
    }

    function handleAppInstalled() {
      clearAutoHideTimer();
      clearCloseTimer();
      setIsInstalled(true);
      setHasCheckedInstallState(true);
      setInstallPrompt(null);
      setShowBanner(false);
      setShowIOSGuide(false);
      setIsClosing(false);
      setIsPrompting(false);
    }

    function handleDisplayModeChange() {
      checkInstalledState();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        checkInstalledState();
      }
    }

    function handlePageShow() {
      checkInstalledState();
    }

    if (ios) {
      showBannerWithAutoHide();
    }

    const displayModeQuery = window.matchMedia(
      "(display-mode: standalone)",
    );

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt,
    );
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    displayModeQuery.addEventListener?.("change", handleDisplayModeChange);

    return () => {
      clearAutoHideTimer();
      clearCloseTimer();
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
      displayModeQuery.removeEventListener?.(
        "change",
        handleDisplayModeChange,
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (isPrompting || checkInstalledState()) return;

    if (isIOS) {
      openInstallGuide();
      return;
    }

    if (!installPrompt) {
      return;
    }

    clearAutoHideTimer();
    setIsPrompting(true);

    const promptEvent = installPrompt;

    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;

      setInstallPrompt(null);
      setShowBanner(false);
      setIsClosing(false);

      if (choice.outcome === "dismissed") {
        setShowBanner(false);
      }
    } catch (error) {
      console.error("App installation error:", error);
      setInstallPrompt(null);
      setShowBanner(false);
      setIsClosing(false);
    } finally {
      setIsPrompting(false);
    }
  }

  function handleTouchEnd(x: number) {
    if (touchStartX !== null && x - touchStartX > 80) {
      hideBanner(true);
    }

    setTouchStartX(null);
  }

  if (!hasCheckedInstallState || isInstalled) {
    return null;
  }

  return (
    <>
      {showBanner ? (
        <div
          onTouchStart={(event) => {
            setTouchStartX(event.touches[0]?.clientX ?? null);
          }}
          onTouchEnd={(event) => {
            handleTouchEnd(event.changedTouches[0]?.clientX ?? 0);
          }}
          className={`fixed left-3 right-3 z-[99999] mx-auto max-w-xl rounded-3xl bg-[#172033] p-4 text-white shadow-2xl transition-transform duration-300 ease-in-out sm:left-auto sm:right-5 sm:w-[420px] ${
            isClosing ? "translate-x-[120%]" : "translate-x-0"
          }`}
          style={{
            top: "calc(env(safe-area-inset-top) + 16px)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
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
            disabled={isPrompting}
            className="mt-4 w-full rounded-2xl bg-[#F7B955] py-3 text-sm font-black text-[#172033] transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
          >
            {isPrompting ? "Opening…" : isIOS ? "How to Install" : "Install App"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void openBanner()}
          className="fixed right-0 top-1/2 z-[99998] flex h-20 w-8 -translate-y-1/2 items-center justify-center rounded-l-full bg-[#A8A8A8] shadow-md transition active:scale-95"
          aria-label="Open install panel"
        >
          <span className="block text-center text-[14px] font-black text-white">
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
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] bg-white text-[#172033] shadow-2xl"
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
                  Safari에서 공유 버튼을 누른 다음 “홈 화면에 추가”를 선택하세요.
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
                  alt="How to add KTown Triangle to the iPhone Home Screen"
                  className="h-auto w-full"
                  loading="eager"
                  decoding="async"
                />
              </div>
            </div>

            <div
              className="border-t border-gray-200 bg-white px-4 pt-4 sm:px-6"
              style={{
                paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
              }}
            >
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-2xl bg-[#172033] py-3 text-sm font-black text-white transition active:scale-[0.98]"
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