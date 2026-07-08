"use client";

import { useEffect, useState } from "react";

export default function InAppBrowserAlert() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem("inAppBrowserAlertDismissed");
    if (dismissed === "true") return;

    const ua = navigator.userAgent.toLowerCase();

    const isInAppBrowser =
      ua.includes("instagram") ||
      ua.includes("fbav") ||
      ua.includes("fban") ||
      ua.includes("facebook") ||
      ua.includes("threads") ||
      ua.includes("barcelona");

    if (isInAppBrowser) setShow(true);
  }, []);

  const closeAlert = () => {
    sessionStorage.setItem("inAppBrowserAlertDismissed", "true");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/65 px-6">
      <div className="w-full max-w-sm rounded-[28px] bg-white px-6 py-7 text-center shadow-2xl">
        <h2 className="text-[24px] font-black leading-tight text-[#172033]">
          Optimized for
          <br />
          Chrome Browser
        </h2>

        <p className="mt-6 text-[15px] leading-7 text-gray-600">
          You are currently viewing this site inside
          <br />
          <span className="font-black text-red-600">
            Instagram, Facebook, or Threads
          </span>
          .
        </p>

        <p className="mt-3 text-[15px] leading-7 text-gray-600">
          If the page does not display correctly,
          <br />
          please open it in Chrome.
        </p>

        <button
          onClick={() => {
            window.location.href =
              "intent://" +
              window.location.host +
              window.location.pathname +
              window.location.search +
              "#Intent;scheme=https;package=com.android.chrome;end";
          }}
          className="mt-6 w-full rounded-2xl bg-blue-600 py-4 text-[16px] font-bold text-white"
        >
          Open in Android Chrome
        </button>

        <button
          onClick={async () => {
            await navigator.clipboard.writeText(window.location.href);
            alert("Website address copied.");
          }}
          className="mt-3 w-full rounded-2xl bg-[#111827] py-4 text-[16px] font-bold text-white"
        >
          Copy Website Address
        </button>

        <p className="mt-5 text-[13px] leading-6 text-gray-500">
          <span className="rounded-md bg-red-50 px-2 py-1 font-black text-red-600">
            iPhone
          </span>{" "}
          users can open this site in Safari or Chrome using the share/menu
          button.
        </p>

        <button
          onClick={closeAlert}
          className="mt-5 text-[15px] font-bold text-gray-500 underline"
        >
          Continue Here
        </button>
      </div>
    </div>
  );
}