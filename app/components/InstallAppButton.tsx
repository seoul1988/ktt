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
    // 홈 화면에 설치된 상태에서는 설치창을 열지 않습니다.
    if (checkInstalledState()) return;

    setShowBanner(true);
    setIsClosing(false);
  }

  useEffect(() => {
    const alreadyInstalled = checkInstalledState();

    /*
     * 아이폰 홈 화면 앱으로 실행된 경우에는
     * 설치 배너와 오른쪽 중앙 버튼 관련 로직을 실행하지 않습니다.
     */
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
      showThenAutoHide();
    }

    function handleAppInstalled() {
      setIsInstalled(true);
      setHasCheckedInstallState(true);
      setInstallPrompt(null);
      setShowBanner(false);
      setShowIOSGuide(false);
      setIsClosing(false);
    }

    /*
     * 아이폰 Safari에서는 beforeinstallprompt가 지원되지 않으므로
     * 설치 방법 배너를 표시합니다.
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

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt,
    );

    window.addEventListener(
      "appinstalled",
      handleAppInstalled,
    );

    window.addEventListener("pageshow", handlePageShow);

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
     * 아이폰 Safari는 자동 설치창이 없으므로
     * 홈 화면 추가 안내 이미지를 보여줍니다.
     */
if (!installPrompt) {
  if (isIOS) {
    setShowIOSGuide(true);
    hideFor24Hours();
    setShowBanner(false);
    setIsClosing(false);
    return;
  }

  setShowBanner(false);
  setIsClosing(false);
  return;
}

    try {
      await installPrompt.prompt();

      const choice = await installPrompt.userChoice;

      if (choice.outcome === "accepted") {
        setIsInstalled(true);
        setShowBanner(false);
      }
    } catch (error) {
      console.error("App installation error:", error);
    } finally {
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

  /*
   * 브라우저 설치 상태 확인이 끝나기 전에는 아무것도 표시하지 않습니다.
   * 이 처리로 홈 화면 앱 실행 직후 버튼이 잠깐 나타나는 현상도 막습니다.
   */
  if (!hasCheckedInstallState) {
    return null;
  }

  /*
   * iPhone 홈 화면 또는 Android/Chrome PWA로 실행된 경우
   * 설치 배너와 오른쪽 중앙 버튼을 모두 제거합니다.
   */
  if (isInstalled) {
    return null;
  }

  /*
   * 일반 데스크톱 브라우저 등 설치 기능이 없는 환경에서는
   * 설치 버튼을 표시하지 않습니다.
   */
   /* if (!installPrompt && !isIOS) {
   * return null;
  } */

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