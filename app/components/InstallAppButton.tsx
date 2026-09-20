"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
   * beforeinstallprompt Ω░¥∞▓┤δèö φò£ δ▓êδºî ∞é¼∞Ü⌐φòá ∞êÿ ∞₧ê∞è╡δïêδïñ.
   * state∞ÖÇ ref∞ùÉ φò¿Ω╗ÿ δ│┤Ω┤Çφòÿ∞ù¼ δ▓äφè╝ φü┤δª¡ ∞ï£ ∞╡£∞ïá Ω░¥∞▓┤δÑ╝ φÖò∞ïñφ₧ê ∞é¼∞Ü⌐φò⌐δïêδïñ.
   */
  const installPromptRef =
    useRef<BeforeInstallPromptEvent | null>(null);

  /*
   * Android Chrome∞ùÉ∞ä£δèö userChoice∞¥ÿ accepted ∞▓ÿδª¼ ∞ºüφ¢ä
   * appinstalled ∞¥┤δ▓ñφè╕δÅä ∞¥┤∞û┤∞ä£ δ░£∞â¥φòá ∞êÿ ∞₧ê∞è╡δïêδïñ.
   * ∞äñ∞╣ÿ ∞Öäδúî ∞òêδé┤Ω░Ç ∞ñæδ│╡ φæ£∞ï£δÉÿ∞ºÇ ∞òèδÅäδí¥ φò£ δ▓êδºî φùê∞Ü⌐φò⌐δïêδïñ.
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
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

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
       * δ╣ä∞ªêδïê∞èñ φÄÿ∞¥┤∞ºÇ metadataΩ░Ç
       * "Business Name | KTown Triangle" φÿò∞ï¥∞¥┤δ⌐┤
       * ∞ò₧δ╢Çδ╢ä∞¥ä ∞äñ∞╣ÿ ∞ò▒ ∞¥┤δªä∞£╝δí£ ∞é¼∞Ü⌐φò⌐δïêδïñ.
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
     * Next.js φü┤δ¥╝∞¥┤∞û╕φè╕ φÄÿ∞¥┤∞ºÇ ∞¥┤δÅÖ∞£╝δí£ document.title∞¥┤
     * δéÿ∞ñæ∞ùÉ δ│ÇΩ▓╜δÉÿδèö Ω▓╜∞Ü░∞ùÉδÅä ∞âê δ╣ä∞ªêδïê∞èñ ∞¥┤δªä∞¥ä δ░ÿ∞ÿüφò⌐δïêδïñ.
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
      // localStorageδÑ╝ ∞é¼∞Ü⌐φòá ∞êÿ ∞ùåδèö δ╕îδ¥╝∞Ü░∞áÇ∞ùÉ∞ä£δèö δ¼┤∞ï£φò⌐δïêδïñ.
    }
  }

  function getInstalledCookieState() {
    try {
      return document.cookie
        .split(";")
        .map((value) => value.trim())
        .some((value) => value === "ktt_pwa_installed=true");
    } catch {
      return false;
    }
  }

  function saveInstalledCookie(installed: boolean) {
    try {
      if (installed) {
        document.cookie =
          "ktt_pwa_installed=true; Max-Age=31536000; Path=/; SameSite=Lax";
      } else {
        document.cookie =
          "ktt_pwa_installed=; Max-Age=0; Path=/; SameSite=Lax";
      }
    } catch {
      // cookieδÑ╝ ∞é¼∞Ü⌐φòá ∞êÿ ∞ùåδèö δ╕îδ¥╝∞Ü░∞áÇ∞ùÉ∞ä£δèö δ¼┤∞ï£φò⌐δïêδïñ.
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

  function getStandaloneState() {
    const displayModeStandalone = window.matchMedia(
      "(display-mode: standalone)",
    ).matches;

    const iosStandalone =
      (window.navigator as IOSNavigator).standalone === true;

    return displayModeStandalone || iosStandalone;
  }

  function getInstalledState() {
    /*
     * ∞ïñ∞á£ ∞ïñφûë δ¬¿δô£δºî ∞äñ∞╣ÿ ∞âüφâ£δí£ φîÉδï¿φò⌐δïêδïñ.
     * localStorage/cookie Ω╕░δí¥∞¥Ç ∞ò▒ ∞é¡∞á£ φ¢ä∞ùÉδÅä δé¿Ω╕░ δòîδ¼╕∞ùÉ
     * ∞äñ∞╣ÿ ∞ù¼δ╢Ç φîÉδï¿∞ùÉδèö ∞é¼∞Ü⌐φòÿ∞ºÇ ∞òè∞è╡δïêδïñ.
     */
    return getStandaloneState();
  }

  function checkInstalledState() {
    const installed = getStandaloneState();

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
      // localStorageδÑ╝ ∞é¼∞Ü⌐φòá ∞êÿ ∞ùåδèö δ╕îδ¥╝∞Ü░∞áÇ∞ùÉ∞ä£δèö δ¼┤∞ï£φò⌐δïêδïñ.
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
     * ∞äñ∞╣ÿ ∞âüφâ£Ω░Ç ∞áÇ∞₧ÑδÉÿ∞û┤ ∞₧ê∞û┤δÅä ∞¥┤δ▓ñφè╕ δª¼∞èñδäêδèö Ω│ä∞åì δô▒δí¥φò⌐δïêδïñ.
     * ∞é¼∞Ü⌐∞₧ÉΩ░Ç ∞ò▒∞¥ä ∞é¡∞á£φòÿδ⌐┤ beforeinstallpromptΩ░Ç δïñ∞ï£ δ░£∞â¥φòá ∞êÿ ∞₧êΩ│á,
     * Ω╖╕δòî δé¿∞òä ∞₧êδèö ∞äñ∞╣ÿ ∞âüφâ£δÑ╝ ∞₧ÉδÅÖ∞£╝δí£ ∞┤êΩ╕░φÖöφò┤∞ò╝ φòÿΩ╕░ δòîδ¼╕∞₧àδïêδïñ.
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
        "Γ£à beforeinstallprompt fired:",
        promptEvent,
      );

      /*
       * stateδºî ∞é¼∞Ü⌐φòÿδ⌐┤ δáîδìöδºü φâÇ∞¥┤δ░ì∞ùÉ δö░δ¥╝ δ▓äφè╝ φü┤δª¡ ∞ï£
       * ∞¥┤∞áä null Ω░Æ∞¥┤ δ│┤∞¥╝ ∞êÿ ∞₧ê∞£╝δ»Çδí£ ref∞ùÉδÅä φò¿Ω╗ÿ ∞áÇ∞₧Ñφò⌐δïêδïñ.
       */
      installPromptRef.current = promptEvent;
      setInstallPrompt(promptEvent);
      setInstallMessage("");

      /*
       * ∞¥┤ ∞¥┤δ▓ñφè╕Ω░Ç δ░£∞â¥φûêδïñδèö Ω▓â∞¥Ç Chrome∞¥┤ φÿä∞₧¼ ∞äñ∞╣ÿ Ω░ÇδèÑ ∞âüφâ£δí£
       * φîÉδï¿φûêδïñδèö δ£╗∞¥┤δ»Çδí£ ∞ªë∞ï£ δ»╕∞äñ∞╣ÿ ∞âüφâ£δí£ ∞áäφÖÿφò⌐δïêδïñ.
       */
      setIsInstalled(false);
      setHasCheckedInstallState(true);



      try {
        localStorage.removeItem(getHideStorageKey());
      } catch {
        // localStorageδÑ╝ ∞é¼∞Ü⌐φòá ∞êÿ ∞ùåδèö δ╕îδ¥╝∞Ü░∞áÇ∞ùÉ∞ä£δèö δ¼┤∞ï£φò⌐δïêδïñ.
      }

      /*
       * ∞äñ∞╣ÿ ∞¥┤δ▓ñφè╕δÑ╝ δ░¢∞¥Ç δÆñ∞ùÉδèö 5∞┤ê φ¢ä ∞₧ÉδÅÖ∞£╝δí£ δï½∞ºÇ ∞òè∞è╡δïêδïñ.
       * ∞é¼∞Ü⌐∞₧ÉΩ░Ç Install App δ▓äφè╝∞¥ä ∞ºü∞áæ δêäδÑ╝ δòîΩ╣î∞ºÇ ∞£á∞ºÇφò⌐δïêδïñ.
       */
      clearAutoTimer();
      setShowBanner(true);
      setIsClosing(false);
    }

    function handleAppInstalled() {
      console.log("Γ£à appinstalled fired");

      installPromptRef.current = null;
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
        // localStorageδÑ╝ ∞é¼∞Ü⌐φòá ∞êÿ ∞ùåδèö δ╕îδ¥╝∞Ü░∞áÇ∞ùÉ∞ä£δèö δ¼┤∞ï£φò⌐δïêδïñ.
      }
    }

    /*
     * iPhone Safari∞ùÉ∞ä£δèö beforeinstallpromptΩ░Ç ∞ùå∞£╝δ»Çδí£
     * 24∞ï£Ω░ä ∞á£φò£∞¥┤ ∞ùå∞¥ä δòî ∞äñ∞╣ÿ ∞òêδé┤ δ░░δäêδÑ╝ φæ£∞ï£φò⌐δïêδïñ.
     */
    if (ios || businessName?.trim()) {
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
     * iPhone/iPad∞ùÉ∞ä£δèö beforeinstallpromptΩ░Ç ∞ùå∞£╝δ»Çδí£
     * φÖê φÖöδ⌐┤ ∞╢öΩ░Ç ∞òêδé┤δÑ╝ φæ£∞ï£φò⌐δïêδïñ.
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
     * Ω░Ç∞₧Ñ ∞╡£Ω╖╝ beforeinstallprompt Ω░¥∞▓┤δÑ╝ ∞é¼∞Ü⌐φò⌐δïêδïñ.
     * refδÑ╝ δ¿╝∞áÇ φÖò∞¥╕φòÿ∞ù¼ React state Ω░▒∞ïá φâÇ∞¥┤δ░ì δ¼╕∞á£δÑ╝ δ░⌐∞ºÇφò⌐δïêδïñ.
     */
    const promptEvent =
      installPromptRef.current || installPrompt;

    console.log("Stored install prompt:", promptEvent);

    if (!promptEvent) {
      /*
       * ∞¥┤δ▓ñφè╕Ω░Ç ∞òä∞ºü ∞ñÇδ╣äδÉÿ∞ºÇ ∞òè∞¥Ç Ω▓╜∞Ü░ δ░░δäêδÑ╝ ∞ùå∞òá∞ºÇ ∞òè∞è╡δïêδïñ.
       * ∞é¼∞Ü⌐∞₧ÉΩ░Ç ∞òäδ¼┤ δ░ÿ∞¥æ∞¥┤ ∞ùåδïñΩ│á δèÉδü╝∞ºÇ ∞òèδÅäδí¥ ∞¥┤∞£áδÑ╝ φæ£∞ï£φò⌐δïêδïñ.
       */
      setInstallMessage(
        "The browser installation window is not available yet. Open the Chrome or Edge menu (⋮) and choose Install app, or reload this page and try again.",
      );
      setShowBanner(true);
      setIsClosing(false);
      return;
    }

    try {
      setInstallMessage("");

      /*
       * prompt()δèö δ░ÿδô£∞ï£ ∞é¼∞Ü⌐∞₧É∞¥ÿ φü┤δª¡ δÅÖ∞₧æ ∞òê∞ùÉ∞ä£ φÿ╕∞╢£φò┤∞ò╝ φò⌐δïêδïñ.
       */
      await promptEvent.prompt();

      console.log("Browser install prompt opened.");

      const choice = await promptEvent.userChoice;

      console.log(
        "Install prompt result:",
        choice.outcome,
      );

      /*
       * ∞¥┤ Ω░¥∞▓┤δèö φò£ δ▓êδºî ∞é¼∞Ü⌐φòá ∞êÿ ∞₧ê∞£╝δ»Çδí£ ∞ªë∞ï£ ∞á£Ω▒░φò⌐δïêδïñ.
       */
      installPromptRef.current = null;
      setInstallPrompt(null);

      if (choice.outcome === "accepted") {
        /*
         * ∞ù¼Ω╕░∞ä£δèö ∞äñ∞╣ÿ∞░╜δºî δï½∞è╡δïêδïñ.
         * ∞äñ∞╣ÿ ∞Öäδúî ∞òêδé┤δèö ∞ïñ∞á£ appinstalled ∞¥┤δ▓ñφè╕∞ùÉ∞ä£ φò£ δ▓êδºî φæ£∞ï£φò⌐δïêδïñ.
         */
        setIsInstalled(true);
        setInstallMessage("");
        setShowBanner(false);
        setIsClosing(false);
        return;
      }

      /*
       * ∞é¼∞Ü⌐∞₧ÉΩ░Ç ∞╖¿∞åîφò£ Ω▓╜∞Ü░ ∞äñ∞╣ÿ ∞Öäδúîδí£ ∞áÇ∞₧Ñφòÿ∞ºÇ ∞òè∞è╡δïêδïñ.
       * ∞ÿñδÑ╕∞¬╜ › δ▓äφè╝∞£╝δí£ δïñ∞ï£ ∞ù┤ ∞êÿ ∞₧êδÅäδí¥ δ░░δäêδºî δï½∞è╡δïêδïñ.
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

  /*
   * ∞äñ∞╣ÿ δ▓äφè╝∞¥Ç KTown δ⌐ö∞¥╕ φÖê(/)∞ùÉ∞ä£δºî φæ£∞ï£φò⌐δïêδïñ.
   * δïñδÑ╕ δ¬¿δôá Ω▓╜δí£∞ùÉ∞ä£δèö businessName ∞áäδï¼ ∞ù¼δ╢Ç∞ÖÇ Ω┤ÇΩ│ä∞ùå∞¥┤
   * ∞äñ∞╣ÿ δ▓äφè╝, ∞äñ∞╣ÿ δ░░δäê, iOS ∞äñ∞╣ÿ ∞òêδé┤δÑ╝ ∞áäδ╢Ç δáîδìöδºüφòÿ∞ºÇ ∞òè∞è╡δïêδïñ.
   */
  const isMainHomePage =
    typeof window !== "undefined" &&
    window.location.pathname === "/";

  // KTown global install button is limited to /.
  // A business-specific instance (businessName provided) is allowed on
  // /business/[id]/website so every business can show its own install UI.
  if (!businessName?.trim() && !isMainHomePage) {
    return null;
  }

  if (!portalReady) {
    return null;
  }

  if (!isInstallOwner) {
    return null;
  }

  if (!hasCheckedInstallState) {
    return null;
  }

  /*
   * ∞äñ∞╣ÿδÉ£ PWA δÿÉδèö iPhone φÖê φÖöδ⌐┤ ∞ò▒∞ùÉ∞ä£δèö
   * δ░░δäê∞ÖÇ ∞ÿñδÑ╕∞¬╜ › δ▓äφè╝∞¥ä δ¬¿δæÉ ∞ê¿Ω╣üδïêδïñ.
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

  return createPortal(
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
                📲 Install {displayName}
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
              ×
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
        (Boolean(businessName?.trim()) || isIOS || installPrompt !== null) ? (
          <button
            type="button"
            onClick={openBanner}
            className="fixed z-[100000] flex h-20 w-8 items-center justify-center rounded-l-full bg-[#A8A8A8] shadow-md transition active:scale-95"
            style={{
              position: "fixed",
              right: 0,
              top: "50dvh",
              transform: "translateY(-50%)",
            }}
            aria-label="Open install panel"
          >
            <span className="block text-center text-[14px] font-black text-white">
              ›
            </span>
          </button>
        ) : null
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
                ×
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
    </>,
    document.body,
  );
}