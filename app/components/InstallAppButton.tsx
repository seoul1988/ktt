"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
  }>;
};

type IOSNavigator = Navigator & {
  standalone?: boolean;
};

const HIDE_KEY = "ktt_install_banner_hide_until";
const HIDE_TIME = 24 * 60 * 60 * 1000;
const AUTO_HIDE_TIME = 5000;

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

  function getInstalledState() {
    const displayModeStandalone = window.matchMedia(
      "(display-mode: standalone)",
    ).matches;

    const iosStandalone =
      (window.navigator as IOSNavigator).standalone === true;

    return displayModeStandalone || iosStandalone;
  }

  function checkInstalledState() {
    const installed = getInstalledState();

    setIsInstalled(installed);
    setHasCheckedInstallState(true);

    if (installed) {
      setInstallPrompt(null);
      setShowBanner(false);
      setShowIOSGuide(false);
      setIsClosing(false);
    }

    return installed;
  }

  function hideFor24Hours() {
    try {
      localStorage.setItem(
        HIDE_KEY,
        String(Date.now() + HIDE_TIME),
      );
    } catch {
      // localStorage를 사용할 수 없는 브라우저에서는 무시합니다.
    }
  }

  function shouldShowBanner() {
    try {
      const hideUntil = Number(
        localStorage.getItem(HIDE_KEY) || 0,
      );

      return Date.now() > hideUntil;
    } catch {
      return true;
    }
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
    if (checkInstalledState()) return;

    setShowBanner(true);
    setIsClosing(false);
  }

  useEffect(() => {
    const alreadyInstalled = checkInstalledState();

    if (alreadyInstalled) {
      return;
    }

    const userAgent = window.navigator.userAgent.toLowerCase();

    const iosDevice =
      /iphone|ipad|ipod/.test(userAgent) ||
      (
        window.navigator.platform === "MacIntel" &&
        window.navigator.maxTouchPoints > 1
      );

    const ios =
      iosDevice &&
      (window.navigator as IOSNavigator).standalone !== true;

    setIsIOS(ios);

    let autoTimer: number | null = null;

    function clearAutoTimer() {
      if (autoTimer !== null) {
        window.clearTimeout(autoTimer);
        autoTimer = null;
      }
    }

    function showThenAutoHide() {
      if (checkInstalledState()) return;
      if (!shouldShowBanner()) return;

      clearAutoTimer();

      setShowBanner(true);
      setIsClosing(false);

      autoTimer = window.setTimeout(() => {
        setIsClosing(true);
        hideFor24Hours();

        window.setTimeout(() => {
          setShowBanner(false);
          setIsClosing(false);
        }, 350);
      }, AUTO_HIDE_TIME);
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();

      if (checkInstalledState()) return;

      setInstallPrompt(event as BeforeInstallPromptEvent);

      /*
       * 24시간 숨김 기간이 끝난 경우에만
       * 자동 설치 배너를 다시 표시합니다.
       */
      showThenAutoHide();
    }

    function handleAppInstalled() {
      setIsInstalled(true);
      setHasCheckedInstallState(true);
      setInstallPrompt(null);
      setShowBanner(false);
      setShowIOSGuide(false);
      setIsClosing(false);

      try {
        localStorage.removeItem(HIDE_KEY);
      } catch {
        // localStorage를 사용할 수 없는 브라우저에서는 무시합니다.
      }
    }

    /*
     * iPhone Safari에서는 beforeinstallprompt가 없으므로
     * 24시간 제한이 없을 때 설치 안내 배너를 표시합니다.
     */
    if (ios) {
      showThenAutoHide();
    }

    const displayModeQuery = window.matchMedia(
      "(display-mode: standalone)",
    );

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

    function handleWindowFocus() {
      checkInstalledState();
    }

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt,
    );

    window.addEventListener(
      "appinstalled",
      handleAppInstalled,
    );

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("focus", handleWindowFocus);

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    displayModeQuery.addEventListener?.(
      "change",
      handleDisplayModeChange,
    );

    return () => {
      clearAutoTimer();

      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );

      window.removeEventListener(
        "appinstalled",
        handleAppInstalled,
      );

      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("focus", handleWindowFocus);

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );

      displayModeQuery.removeEventListener?.(
        "change",
        handleDisplayModeChange,
      );
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
    if (checkInstalledState()) return;

    /*
     * iPhone/iPad에서는 브라우저 자동 설치창을 제공하지 않으므로
     * 홈 화면 추가 안내 이미지를 표시합니다.
     */
    if (isIOS && !installPrompt) {
      hideFor24Hours();
      setShowIOSGuide(true);
      setShowBanner(false);
      setIsClosing(false);
      return;
    }

    /*
     * Chrome/Edge에서 beforeinstallprompt가 아직 준비되지 않았다면
     * 별도 Chrome/Edge 설명 모달은 띄우지 않습니다.
     */
    if (!installPrompt) {
      setShowBanner(false);
      setIsClosing(false);
      return;
    }

    try {
      await installPrompt.prompt();

      const choice = await installPrompt.userChoice;

      /*
       * beforeinstallprompt 객체는 한 번만 사용할 수 있습니다.
       */
      setInstallPrompt(null);

      /*
       * 설치를 수락하거나 취소한 뒤에는 자동 배너를
       * 24시간 동안 다시 표시하지 않습니다.
       * 오른쪽 ≡ 버튼을 누르면 수동으로 다시 열 수 있습니다.
       */
      hideFor24Hours();
      setShowBanner(false);
      setIsClosing(false);

      if (choice.outcome === "accepted") {
        /*
         * 실제 설치 완료 처리는 appinstalled 이벤트가 담당합니다.
         */
      }
    } catch (error) {
      console.error("App installation error:", error);

      setInstallPrompt(null);
      hideFor24Hours();
      setShowBanner(false);
      setIsClosing(false);
    }
  }

  function handleTouchEnd(x: number) {
    if (
      touchStartX !== null &&
      x - touchStartX > 80
    ) {
      hideBanner(true);
    }

    setTouchStartX(null);
  }

  if (!hasCheckedInstallState) {
    return null;
  }

  /*
   * 설치된 PWA 또는 iPhone 홈 화면 앱에서는
   * 배너와 오른쪽 ≡ 버튼을 모두 숨깁니다.
   */
  if (isInstalled) {
    return null;
  }

  return (
    <>
      {showBanner ? (
        <div
          onTouchStart={(event) => {
            setTouchStartX(
              event.touches[0]?.clientX ?? null,
            );
          }}
          onTouchEnd={(event) => {
            handleTouchEnd(
              event.changedTouches[0]?.clientX ?? 0,
            );
          }}
          className={`fixed left-4 right-4 z-[99999] rounded-3xl bg-[#172033] p-4 text-white shadow-2xl transition-transform duration-300 ease-in-out ${
            isClosing
              ? "translate-x-[120%]"
              : "translate-x-0"
          }`}
          style={{
            top: "calc(env(safe-area-inset-top) + 16px)",
          }}
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
            className="mt-4 w-full rounded-2xl bg-[#F7B955] py-3 text-sm font-black text-[#172033] transition active:scale-[0.98]"
          >
            Install App
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={openBanner}
          className="fixed right-0 top-1/2 z-[2000] flex h-20 w-8 -translate-y-1/2 items-center justify-center rounded-l-full bg-[#A8A8A8] shadow-md transition active:scale-95"
          aria-label="Open install panel"
        >
          <span className="block text-center text-[14px] font-black text-white">
            ≡
          </span>
        </button>
      )}

      {showIOSGuide && isIOS && (
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
                  Follow the image below to add KTown Triangle
                  to your iPhone Home Screen.
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

            <div
              className="border-t border-gray-200 bg-white px-4 pt-4 sm:px-6"
              style={{
                paddingBottom:
                  "calc(env(safe-area-inset-bottom) + 16px)",
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