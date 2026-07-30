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

const MAIN_HIDE_KEY = "ktt_install_banner_hide_until";
const MAIN_INSTALLED_KEY = "ktt_pwa_installed";
const HIDE_TIME = 24 * 60 * 60 * 1000;
const AUTO_HIDE_TIME = 5000;

type InstallAppButtonProps = {
  businessName?: string;
};

export default function InstallAppButton({
  businessName,
}: InstallAppButtonProps) {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [hasCheckedInstallState, setHasCheckedInstallState] =
    useState(false);

  const [displayName, setDisplayName] = useState(
    businessName?.trim() || "KTown Triangle",
  );

  const [showBanner, setShowBanner] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showInstalledNotice, setShowInstalledNotice] =
    useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const explicitName = businessName?.trim();

    function updateDisplayName() {
      if (explicitName) {
        setDisplayName(explicitName);
        return;
      }

      /*
       * 비즈니스 페이지 metadata가
       * "Business Name | KTown Triangle" 형식이면
       * 앞부분을 설치 앱 이름으로 사용합니다.
       */
      const pageTitle = document.title
        .split("|")[0]
        ?.trim();

      if (
        pageTitle &&
        pageTitle.toLowerCase() !== "ktown triangle"
      ) {
        setDisplayName(pageTitle);
      } else {
        setDisplayName("KTown Triangle");
      }
    }

    updateDisplayName();

    /*
     * Next.js 클라이언트 페이지 이동으로 document.title이
     * 나중에 변경되는 경우에도 새 비즈니스 이름을 반영합니다.
     */
    const titleElement = document.querySelector("title");

    if (!titleElement) {
      return;
    }

    const observer = new MutationObserver(updateDisplayName);

    observer.observe(titleElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [businessName]);

  function getBusinessIdFromPath() {
    if (typeof window === "undefined") {
      return null;
    }

    const match = window.location.pathname.match(
      /^\/business(?:es)?\/(\d+)\/website(?:\/|$)/,
    );

    return match?.[1] || null;
  }

  function getInstalledStorageKey() {
    const businessId = getBusinessIdFromPath();

    return businessId
      ? `ktt_business_${businessId}_pwa_installed`
      : MAIN_INSTALLED_KEY;
  }

  function getHideStorageKey() {
    const businessId = getBusinessIdFromPath();

    return businessId
      ? `ktt_business_${businessId}_install_banner_hide_until`
      : MAIN_HIDE_KEY;
  }

  function getSavedInstalledState() {
    try {
      return localStorage.getItem(getInstalledStorageKey()) === "true";
    } catch {
      return false;
    }
  }

  function saveInstalledState(installed: boolean) {
    try {
      if (installed) {
        localStorage.setItem(getInstalledStorageKey(), "true");
      } else {
        localStorage.removeItem(getInstalledStorageKey());
      }
    } catch {
      // localStorage를 사용할 수 없는 브라우저에서는 무시합니다.
    }
  }

  function showInstallationCompleteNotice() {
    setShowInstalledNotice(true);

    window.setTimeout(() => {
      setShowInstalledNotice(false);
    }, 4000);
  }

  function getInstalledState() {
    const displayModeStandalone = window.matchMedia(
      "(display-mode: standalone)",
    ).matches;

    const iosStandalone =
      (window.navigator as IOSNavigator).standalone === true;

    const businessId = getBusinessIdFromPath();

    /*
     * 비즈니스 웹에서는 메인 KTown 앱의 standalone 상태를
     * 해당 비즈니스 앱 설치 상태로 사용하면 안 됩니다.
     * 비즈니스별 저장 키만 확인합니다.
     */
    if (businessId) {
      return getSavedInstalledState();
    }

    return (
      displayModeStandalone ||
      iosStandalone ||
      getSavedInstalledState()
    );
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
        getHideStorageKey(),
        String(Date.now() + HIDE_TIME),
      );
    } catch {
      // localStorage를 사용할 수 없는 브라우저에서는 무시합니다.
    }
  }

  function shouldShowBanner() {
    try {
      const hideUntil = Number(
        localStorage.getItem(getHideStorageKey()) || 0,
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

      /*
       * beforeinstallprompt가 다시 발생했다는 것은 브라우저가
       * 현재 앱을 설치할 수 있다고 판단했다는 뜻입니다.
       * 앱을 삭제한 경우 저장된 설치 상태를 해제합니다.
       */
      saveInstalledState(false);
      setIsInstalled(false);
      setInstallPrompt(event as BeforeInstallPromptEvent);

      /*
       * 24시간 숨김 기간이 끝난 경우에만
       * 자동 설치 배너를 다시 표시합니다.
       */
      showThenAutoHide();
    }

    function handleAppInstalled() {
      saveInstalledState(true);
      setIsInstalled(true);
      setHasCheckedInstallState(true);
      setInstallPrompt(null);
      setShowBanner(false);
      setShowIOSGuide(false);
      setIsClosing(false);
      showInstallationCompleteNotice();

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
         * 현재 브라우저 탭은 설치 후에도 browser 모드로 남아 있을 수
         * 있으므로 설치 완료 상태를 별도로 저장합니다.
         */
        saveInstalledState(true);
        setIsInstalled(true);
        showInstallationCompleteNotice();
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
    return showInstalledNotice ? (
      <div
        className="fixed left-1/2 top-5 z-[100001] w-[calc(100%-32px)] max-w-sm -translate-x-1/2 rounded-2xl bg-[#172033] px-5 py-4 text-center text-white shadow-2xl"
        role="status"
        aria-live="polite"
      >
        <p className="text-sm font-black">
          ✓ {displayName} has been installed.
        </p>
        <p className="mt-1 text-xs font-semibold text-white/75">
          You can now open it from your apps or Home Screen.
        </p>
      </div>
    ) : null;
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
                📱 Install {displayName}
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
                  Install {displayName}
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