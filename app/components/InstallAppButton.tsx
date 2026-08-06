"use client";

import { useEffect, useRef, useState } from "react";

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

type InstallOwner = {
  id: string;
  priority: number;
};

declare global {
  interface Window {
    __KTT_INSTALL_OWNER__?: InstallOwner;
  }
}

const INSTALL_OWNER_CHANGE_EVENT = "ktt-install-owner-change";

export default function InstallAppButton({
  businessName,
}: InstallAppButtonProps) {
  const instanceIdRef = useRef(
    `ktt-install-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const ownerPriority = businessName?.trim() ? 2 : 1;
  const [isInstallOwner, setIsInstallOwner] = useState(false);

  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  /*
   * beforeinstallprompt 객체는 한 번만 사용할 수 있습니다.
   * state와 ref에 함께 보관하여 버튼 클릭 시 최신 객체를 확실히 사용합니다.
   */
  const installPromptRef =
    useRef<BeforeInstallPromptEvent | null>(null);

  /*
   * Android Chrome에서는 userChoice의 accepted 처리 직후
   * appinstalled 이벤트도 이어서 발생할 수 있습니다.
   * 설치 완료 안내가 중복 표시되지 않도록 한 번만 허용합니다.
   */
  const installedNoticeShownRef = useRef(false);
  const installedNoticeTimerRef = useRef<number | null>(null);

  const [installMessage, setInstallMessage] = useState("");

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
    const instanceId = instanceIdRef.current;

    function syncOwnership() {
      const currentOwner = window.__KTT_INSTALL_OWNER__;

      if (
        !currentOwner ||
        currentOwner.id === instanceId ||
        currentOwner.priority < ownerPriority
      ) {
        window.__KTT_INSTALL_OWNER__ = {
          id: instanceId,
          priority: ownerPriority,
        };
      }

      setIsInstallOwner(
        window.__KTT_INSTALL_OWNER__?.id === instanceId,
      );
    }

    function handleOwnerChange() {
      syncOwnership();
    }

    window.addEventListener(
      INSTALL_OWNER_CHANGE_EVENT,
      handleOwnerChange,
    );

    syncOwnership();
    window.dispatchEvent(new Event(INSTALL_OWNER_CHANGE_EVENT));

    return () => {
      window.removeEventListener(
        INSTALL_OWNER_CHANGE_EVENT,
        handleOwnerChange,
      );

      if (window.__KTT_INSTALL_OWNER__?.id === instanceId) {
        delete window.__KTT_INSTALL_OWNER__;
        window.dispatchEvent(
          new Event(INSTALL_OWNER_CHANGE_EVENT),
        );
      }
    };
  }, [ownerPriority]);

  useEffect(() => {
    if (!isInstallOwner) return;

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
  }, [businessName, isInstallOwner]);

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
    if (installedNoticeShownRef.current) {
      return;
    }

    installedNoticeShownRef.current = true;
    setShowInstalledNotice(true);

    if (installedNoticeTimerRef.current !== null) {
      window.clearTimeout(installedNoticeTimerRef.current);
    }

    installedNoticeTimerRef.current = window.setTimeout(() => {
      setShowInstalledNotice(false);
      installedNoticeShownRef.current = false;
      installedNoticeTimerRef.current = null;
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
      return (
        displayModeStandalone ||
        iosStandalone ||
        getSavedInstalledState()
      );
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
      installPromptRef.current = null;
      setInstallPrompt(null);
      setInstallMessage("");
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

    setInstallMessage("");
    setShowBanner(true);
    setIsClosing(false);
  }

  useEffect(() => {
    if (!isInstallOwner) return;

    /*
     * 설치 상태가 저장되어 있어도 이벤트 리스너는 계속 등록합니다.
     * 사용자가 앱을 삭제하면 beforeinstallprompt가 다시 발생할 수 있고,
     * 그때 남아 있는 설치 상태를 자동으로 초기화해야 하기 때문입니다.
     */
    checkInstalledState();

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

      const promptEvent =
        event as BeforeInstallPromptEvent;

      console.log(
        "✅ beforeinstallprompt fired:",
        promptEvent,
      );

      /*
       * state만 사용하면 렌더링 타이밍에 따라 버튼 클릭 시
       * 이전 null 값이 보일 수 있으므로 ref에도 함께 저장합니다.
       */
      installPromptRef.current = promptEvent;
      setInstallPrompt(promptEvent);
      setInstallMessage("");

      /*
       * 같은 도메인의 메인 앱 또는 브라우저 상태 때문에
       * beforeinstallprompt가 다시 발생할 수 있습니다.
       * 이미 저장된 비즈니스 앱 설치 상태는 여기서 지우지 않습니다.
       */
      setHasCheckedInstallState(true);

      try {
        localStorage.removeItem(getHideStorageKey());
      } catch {
        // localStorage를 사용할 수 없는 브라우저에서는 무시합니다.
      }

      /*
       * 설치 이벤트를 받은 뒤에는 5초 후 자동으로 닫지 않습니다.
       * 사용자가 Install App 버튼을 직접 누를 때까지 유지합니다.
       */
      clearAutoTimer();
      setShowBanner(true);
      setIsClosing(false);
    }

    function handleAppInstalled() {
      console.log("✅ appinstalled fired");

      installPromptRef.current = null;
      saveInstalledState(true);
      setIsInstalled(true);
      setHasCheckedInstallState(true);
      setInstallPrompt(null);
      setInstallMessage("");
      setShowBanner(false);
      setShowIOSGuide(false);
      setIsClosing(false);
      showInstallationCompleteNotice();

      try {
        localStorage.removeItem(getHideStorageKey());
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

      if (installedNoticeTimerRef.current !== null) {
        window.clearTimeout(installedNoticeTimerRef.current);
        installedNoticeTimerRef.current = null;
      }

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
  }, [isInstallOwner]);

  useEffect(() => {
    if (!isInstallOwner || !showIOSGuide) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isInstallOwner, showIOSGuide]);

  async function installApp() {
    console.log("Install button clicked.");

    if (checkInstalledState()) {
      console.log("The app is already marked as installed.");
      return;
    }

    /*
     * iPhone/iPad에서는 beforeinstallprompt가 없으므로
     * 홈 화면 추가 안내를 표시합니다.
     */
    if (isIOS) {
      hideFor24Hours();
      setInstallMessage("");
      setShowIOSGuide(true);
      setShowBanner(false);
      setIsClosing(false);
      return;
    }

    /*
     * 가장 최근 beforeinstallprompt 객체를 사용합니다.
     * ref를 먼저 확인하여 React state 갱신 타이밍 문제를 방지합니다.
     */
    const promptEvent =
      installPromptRef.current || installPrompt;

    console.log("Stored install prompt:", promptEvent);

    if (!promptEvent) {
      /*
       * 이벤트가 아직 준비되지 않은 경우 배너를 없애지 않습니다.
       * 사용자가 아무 반응이 없다고 느끼지 않도록 이유를 표시합니다.
       */
      setInstallMessage(
        "The browser installation window is not available yet. Open the Chrome or Edge menu ⋮ and choose Install app, or reload this page and try again.",
      );
      setShowBanner(true);
      setIsClosing(false);
      return;
    }

    try {
      setInstallMessage("");

      /*
       * prompt()는 반드시 사용자의 클릭 동작 안에서 호출해야 합니다.
       */
      await promptEvent.prompt();

      console.log("Browser install prompt opened.");

      const choice = await promptEvent.userChoice;

      console.log(
        "Install prompt result:",
        choice.outcome,
      );

      /*
       * 이 객체는 한 번만 사용할 수 있으므로 즉시 제거합니다.
       */
      installPromptRef.current = null;
      setInstallPrompt(null);

      if (choice.outcome === "accepted") {
        /*
         * 여기서는 설치창만 닫습니다.
         * 설치 완료 안내는 실제 appinstalled 이벤트에서 한 번만 표시합니다.
         */
        saveInstalledState(true);
        setIsInstalled(true);
        setInstallMessage("");
        setShowBanner(false);
        setIsClosing(false);
        return;
      }

      /*
       * 사용자가 취소한 경우 설치 완료로 저장하지 않습니다.
       * 오른쪽 ≡ 버튼으로 다시 열 수 있도록 배너만 닫습니다.
       */
      saveInstalledState(false);
      hideFor24Hours();
      setInstallMessage("");
      setShowBanner(false);
      setIsClosing(false);
    } catch (error) {
      console.error("App installation error:", error);

      installPromptRef.current = null;
      setInstallPrompt(null);
      saveInstalledState(false);

      setInstallMessage(
        "The installation window could not be opened. Reload the page, then try again.",
      );
      setShowBanner(true);
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

  if (!isInstallOwner) {
    return null;
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

              {installMessage ? (
                <p
                  className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold leading-5 text-white"
                  role="alert"
                >
                  {installMessage}
                </p>
              ) : null}
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