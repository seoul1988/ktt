"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type InstallOwner = { id: string; priority: number };
declare global {
  interface Window { __KTT_INSTALL_OWNER__?: InstallOwner }
}
const OWNER_EVENT = "ktt-install-owner-change";
const STATE_EVENT = "ktt-install-state-change";
const DAY = 24 * 60 * 60 * 1000;

function storageKey(suffix: string) {
  const id = window.location.pathname.match(/^\/business(?:es)?\/(\d+)\/website(?:\/|$)/)?.[1];
  return id ? `ktt_business_${id}_${suffix}` : `ktt_${suffix}`;
}
function readStorage(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* Private browsing may disable storage. */ }
}
function standalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export default function InstallAppButton({ businessName }: { businessName?: string }) {
  const id = useRef("");
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const installedRef = useRef(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [owner, setOwner] = useState(false);
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [available, setAvailable] = useState(false);
  const [ios, setIos] = useState(false);
  const [banner, setBanner] = useState(false);
  const [guide, setGuide] = useState(false);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState(false);
  const [name, setName] = useState(businessName?.trim() || "KTown Triangle");
  const touchX = useRef<number | null>(null);
  const priority = businessName?.trim() ? 2 : 1;

  useEffect(() => {
    setReady(true);
    id.current ||= `ktt-install-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    function sync() {
      const current = window.__KTT_INSTALL_OWNER__;
      if (!current || current.priority < priority) {
        window.__KTT_INSTALL_OWNER__ = { id: id.current, priority };
      }
      setOwner(window.__KTT_INSTALL_OWNER__?.id === id.current);
    }
    window.addEventListener(OWNER_EVENT, sync);
    sync();
    window.dispatchEvent(new Event(OWNER_EVENT));
    return () => {
      window.removeEventListener(OWNER_EVENT, sync);
      if (window.__KTT_INSTALL_OWNER__?.id === id.current) {
        delete window.__KTT_INSTALL_OWNER__;
        window.dispatchEvent(new Event(OWNER_EVENT));
      }
    };
  }, [priority]);

  useEffect(() => {
    if (!owner) return;
    function update() {
      setName(businessName?.trim() || document.title.split("|")[0]?.trim() || "KTown Triangle");
    }
    update();
    const title = document.querySelector("title");
    const observer = new MutationObserver(update);
    if (title) observer.observe(title, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [businessName, owner]);

  useEffect(() => {
    if (!owner) return;
    const installedKey = storageKey("pwa_installed");
    const hideKey = storageKey("install_banner_hide_until");
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIos(isIos);
    function clearTimer() {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
    }
    function markInstalled() {
      clearTimer();
      installedRef.current = true;
      writeStorage(installedKey, "true");
      promptRef.current = null;
      setInstalled(true);
      setAvailable(false);
      setBanner(false);
      setGuide(false);
      setMessage("");
    }
    function check() {
      if (standalone() || readStorage(installedKey) === "true" || installedRef.current) {
        markInstalled();
        return true;
      }
      return false;
    }
    function onPrompt(event: Event) {
      event.preventDefault();
      // Installation eligibility is not proof that a previous installation
      // or the user's explicit suppression should be forgotten.
      if (check()) return;
      clearTimer();
      promptRef.current = event as BeforeInstallPromptEvent;
      setAvailable(true);
      setMessage("");
      if (Date.now() > Number(readStorage(hideKey) || 0)) setBanner(true);
    }
    function onInstalled() {
      markInstalled();
      window.dispatchEvent(new Event(STATE_EVENT));
      setNotice(true);
      if (noticeTimer.current !== null) clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setNotice(false), 4000);
    }
    function onVisible() { if (document.visibilityState === "visible") check(); }
    function onStorage(event: StorageEvent) { if (event.key === installedKey) check(); }
    const mode = window.matchMedia("(display-mode: standalone)");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("pageshow", check);
    window.addEventListener("focus", check);
    window.addEventListener("storage", onStorage);
    window.addEventListener(STATE_EVENT, check);
    document.addEventListener("visibilitychange", onVisible);
    mode.addEventListener?.("change", check);
    if (!check() && isIos && Date.now() > Number(readStorage(hideKey) || 0)) {
      setBanner(true);
      timer.current = setTimeout(() => {
        setBanner(false);
        writeStorage(hideKey, String(Date.now() + DAY));
      }, 5000);
    }
    return () => {
      clearTimer();
      if (noticeTimer.current !== null) clearTimeout(noticeTimer.current);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("pageshow", check);
      window.removeEventListener("focus", check);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(STATE_EVENT, check);
      document.removeEventListener("visibilitychange", onVisible);
      mode.removeEventListener?.("change", check);
    };
  }, [owner]);

  useEffect(() => {
    if (!guide || !owner) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [guide, owner]);

  function close() {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    writeStorage(storageKey("install_banner_hide_until"), String(Date.now() + DAY));
    setBanner(false);
    setGuide(false);
  }
  function remember() {
    installedRef.current = true;
    writeStorage(storageKey("pwa_installed"), "true");
    promptRef.current = null;
    setInstalled(true);
    setAvailable(false);
    setBanner(false);
    setGuide(false);
    window.dispatchEvent(new Event(STATE_EVENT));
  }
  async function install() {
    if (standalone() || installedRef.current) { remember(); return; }
    if (ios) {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
      setBanner(false);
      setGuide(true);
      return;
    }
    const event = promptRef.current;
    if (!event) { setBanner(false); return; }
    promptRef.current = null;
    setAvailable(false);
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === "accepted") {
        // Suppress immediately; appinstalled confirms actual completion.
        close();
      } else close();
    } catch {
      setMessage("The installation window could not be opened. Reload the page, then try again.");
      setBanner(true);
    }
  }

  if (!ready || !owner) return null;
  if (!businessName?.trim() && window.location.pathname !== "/") return null;
  if (installed) return notice ? createPortal(
    <div role="status" aria-live="polite" className="fixed left-1/2 top-5 z-[100001] w-[calc(100%-32px)] max-w-sm -translate-x-1/2 rounded-2xl bg-[#172033] px-5 py-4 text-center text-white shadow-2xl">
      <p className="text-sm font-black">✓ {name} has been installed.</p>
      <p className="mt-1 text-xs text-white/75">You can now open it from your apps or Home Screen.</p>
    </div>, document.body) : null;
  // No unconditional custom-domain fallback: already-installed Chrome apps
  // do not need to be detected through the browser address bar.
  if (!ios && !available && !banner) return null;
  return createPortal(<>
    {banner ? <div
      onTouchStart={e => { touchX.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={e => {
        if (touchX.current !== null && (e.changedTouches[0]?.clientX ?? 0) - touchX.current > 80) close();
        touchX.current = null;
      }}
      className="fixed left-4 right-4 z-[99999] rounded-3xl bg-[#172033] p-4 text-white shadow-2xl"
      style={{ top: "calc(env(safe-area-inset-top) + 16px)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1"><p className="text-sm font-black">📲 Install {name}</p>
          <p className="mt-1 text-xs font-semibold text-white/75">Add this app to your phone for faster access.</p>
          {message && <p role="alert" className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-xs leading-5">{message}</p>}
        </div>
        <button type="button" onClick={close} aria-label="Close install banner" className="rounded-full bg-white/15 px-3 py-1 text-xs font-black">×</button>
      </div>
      <button type="button" onClick={install} className="mt-4 w-full rounded-2xl bg-[#F7B955] py-3 text-sm font-black text-[#172033]">Install App</button>
      <button type="button" onClick={remember} className="mt-3 w-full py-2 text-xs font-semibold text-white/80 underline underline-offset-2">Already installed? Don't show this again</button>
    </div> : !guide && (ios || available) ? <button type="button" onClick={() => { setMessage(""); setBanner(true); }} aria-label="Open install panel"
      className="fixed z-[100000] flex h-20 w-8 items-center justify-center rounded-l-full bg-[#A8A8A8] shadow-md"
      style={{ right: 0, top: "50dvh", transform: "translateY(-50%)" }}><span className="text-[14px] font-black text-white">›</span></button> : null}
    {guide && ios && <div className="fixed inset-0 z-[100000] flex items-end justify-center bg-black/60 p-3 backdrop-blur-[2px] sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="ios-install-guide-title" onClick={() => setGuide(false)}>
      <div onClick={e => e.stopPropagation()} className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] bg-white text-[#172033] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-6">
          <div><h2 id="ios-install-guide-title" className="text-lg font-black sm:text-xl">Install {name}</h2>
            <p className="mt-1 text-xs font-semibold text-gray-500 sm:text-sm">Open this page in Safari, tap Share, then Add to Home Screen.</p></div>
          <button type="button" onClick={() => setGuide(false)} aria-label="Close installation guide" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-lg font-black">×</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#F8F9FB] p-2 sm:p-4"><img src="/images/ios-install-guide.png" alt={`How to add ${name} to the iPhone Home Screen`} className="mx-auto h-auto w-full rounded-2xl" /></div>
        <div className="border-t border-gray-200 px-4 pt-4 sm:px-6" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}>
          <button type="button" onClick={() => setGuide(false)} className="w-full rounded-2xl bg-[#172033] py-3 text-sm font-black text-white">Close</button>
        </div>
      </div>
    </div>}
  </>, document.body);
}
