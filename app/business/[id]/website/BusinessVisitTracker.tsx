"use client";

import { useEffect } from "react";

type Props = {
  businessId: number;
};

const VISITOR_KEY = "ktown_anonymous_visitor_id";

function getVisitorId() {
  try {
    let visitorId = window.localStorage.getItem(VISITOR_KEY);

    if (!visitorId) {
      visitorId = crypto.randomUUID();
      window.localStorage.setItem(VISITOR_KEY, visitorId);
    }

    return visitorId;
  } catch {
    return crypto.randomUUID();
  }
}

function detectSource() {
  const params = new URLSearchParams(window.location.search);
  const utmSource = (params.get("utm_source") || "").toLowerCase();

  if (utmSource.includes("instagram")) return "instagram";
  if (utmSource.includes("google")) return "google";
  if (utmSource.includes("ktown")) return "ktowntriangle";
  if (utmSource.includes("facebook") || utmSource === "fb") return "facebook";

  if (!document.referrer) return "direct";

  try {
    const hostname = new URL(document.referrer).hostname
      .replace(/^www\./, "")
      .toLowerCase();

    if (hostname.includes("google.")) return "google";
    if (hostname.includes("instagram.com")) return "instagram";
    if (hostname.includes("ktowntriangle.com")) return "ktowntriangle";
    if (hostname.includes("facebook.com") || hostname.includes("fb.com")) {
      return "facebook";
    }

    if (hostname === window.location.hostname.replace(/^www\./, "")) {
      return "internal";
    }

    return "other";
  } catch {
    return "other";
  }
}

export default function BusinessVisitTracker({ businessId }: Props) {
  useEffect(() => {
    const body = JSON.stringify({
      businessId,
      visitorId: getVisitorId(),
      source: detectSource(),
      path: `${window.location.pathname}${window.location.search}`,
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/business-website-visit",
        new Blob([body], { type: "application/json" }),
      );
      return;
    }

    void fetch("/api/business-website-visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  }, [businessId]);

  return null;
}
