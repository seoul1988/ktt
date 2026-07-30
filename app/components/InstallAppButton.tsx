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
  const [showInstallGuide, setShowInstallGuide] = useState(false);
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
      setShowInstallGuide(false);
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
       * 설치 이벤트가 다시 발생했다는 것은 브라우저에서
       * 현재 사이트를 다시 설치할 수 있다는 뜻입니다.
       * 자동 배너 숨김 기록은 지우고 설치 안내를 다시 표시합니다.
       */
      try {
        localStorage.removeItem(HIDE_KEY);
      } catch {
        // localStorage를 사용할 수 없는 브라우저에서는 무시합니다.
      }

      showThenAutoHide();
    }

    function handleAppInstalled() {
      setIsInstalled(true);
      setHasCheckedInstallState(true);
      setInstallPrompt(null);
      setShowBanner(false);
      setShowInstallGuide(false);
      setIsClosing(false);

      try {
        localStorage.removeItem(HIDE_KEY);
      } catch {
        // localStorage를 사용할 수 없는 브라우저에서는 무시합니다.
      }
    }

    /*
     * iPhone Safari는 beforeinstallprompt를 지원하지 않으므로
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
    if (!showInstallGuide) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showInstallGuide]);

  async function installApp() {
    if (checkInstalledState()) return;

    /*
     * iPhone/iPad 또는 beforeinstallprompt가 아직 없는 브라우저는
     * 수동 설치 방법을 보여줍니다.
     */
    if (!installPrompt) {
      setShowInstallGuide(true);
      setShowBanner(false);
      setIsClosing(false);
      return;
    }

    try {
      await installPrompt.prompt();

      const choice = await installPrompt.userChoice;

      /*
       * beforeinstallprompt 객체는 한 번만 사용할 수 있으므로
       * 사용자 선택 이후에는 비웁니다.
       */
      setInstallPrompt(null);

      if (choice.outcome === "accepted") {
        /*
         * 실제 설치 완료 처리는 appinstalled 이벤트에서 합니다.
         * 설치창을 수락했을 때 현재 배너만 닫습니다.
         */
        setShowBanner(false);
        setIsClosing(false);
      } else {
        /*
         * 사용자가 설치를 취소했어도 오른쪽 ≡ 버튼은 남겨두므로
         * 언제든 다시 시도할 수 있습니다.
         */
        setShowBanner(false);
        setIsClosing(false);
      }
    } catch (error) {
      console.error("App installation error:", error);
      setInstallPrompt(null);
      setShowInstallGuide(true);
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
   * 홈 화면 앱 또는 설치된 PWA 안에서는
   * 배너과 오른쪽 ≡ 버튼을 모두 표시하지 않습니다.
   */
  if (isInstalled) {
    return null;
  }

  /*
   * 중요:
   * installPrompt가 아직 없어도 return null 하지 않습니다.
   * 따라서 앱을 삭제한 뒤 일반 브라우저로 다시 접속하면
   * 오른쪽 ≡ 설치 버튼이 다시 나타납니다.
   */
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

      {showInstallGuide && (
        <div
          className="fixed inset-0 z-[100000] flex items-end justify-center bg-black/60 p-3 backdrop-blur-[2px] sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-guide-title"
          onClick={() => setShowInstallGuide(false)}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] bg-white text-[#172033] shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-6">
              <div>
                <h2
                  id="install-guide-title"
                  className="text-lg font-black sm:text-xl"
                >
                  Install KTown Triangle
                </h2>

                <p className="mt-1 text-xs font-semibold text-gray-500 sm:text-sm">
                  {isIOS
                    ? "Follow the image below to add KTown Triangle to your iPhone Home Screen."
                    : "Use your browser menu to install KTown Triangle."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowInstallGuide(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-lg font-black text-gray-600"
                aria-label="Close installation guide"
              >
                ✕
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-[#F8F9FB] p-3 sm:p-4">
              {isIOS ? (
                <div className="mx-auto overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <img
                    src="/images/ios-install-guide.png"
                    alt="How to add KTownTriangle.com to the iPhone Home Screen"
                    className="h-auto w-full"
                    loading="eager"
                    decoding="async"
                  />
                </div>
              ) : (
                <div className="mx-auto max-w-xl space-y-3">
                  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="font-black">Chrome</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-gray-600">
                      Open the browser menu ⋮ and select
                      <strong> Install KTown Triangle</strong> or
                      <strong> Add to Home screen</strong>.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="font-black">Microsoft Edge</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-gray-600">
                      Open the browser menu ⋯ and select
                      <strong> Apps → Install this site as an app</strong>.
                    </p>
                  </div>

                  <p className="px-1 text-xs font-semibold leading-5 text-gray-500">
                    After deleting the app, refresh this browser page once.
                    The install option may take a moment to become available again.
                  </p>
                </div>
              )}
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
                onClick={() => setShowInstallGuide(false)}
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