"use client";

import { useEffect } from "react";
import { supabase } from "../../lib/supabase";

function createVisitorId() {
  if (
    typeof window !== "undefined" &&
    typeof window.crypto !== "undefined" &&
    typeof window.crypto.randomUUID === "function"
  ) {
    return window.crypto.randomUUID();
  }

  if (
    typeof window !== "undefined" &&
    typeof window.crypto !== "undefined" &&
    typeof window.crypto.getRandomValues === "function"
  ) {
    const bytes = new Uint8Array(16);

    window.crypto.getRandomValues(bytes);

    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");

    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join("-");
  }

  return `visitor-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

function detectDeviceOs() {
  const userAgent = navigator.userAgent.toLowerCase();

  if (
    userAgent.includes("iphone") ||
    userAgent.includes("ipad") ||
    userAgent.includes("ipod")
  ) {
    return "iOS";
  }

  if (userAgent.includes("android")) {
    return "Android";
  }

  if (userAgent.includes("windows")) {
    return "Windows";
  }

  if (
    userAgent.includes("macintosh") ||
    userAgent.includes("mac os")
  ) {
    return "macOS";
  }

  if (userAgent.includes("linux")) {
    return "Linux";
  }

  return "Unknown";
}

export default function VisitorTracker() {
  useEffect(() => {
    async function trackVisit() {
      try {
        let visitorId = localStorage.getItem("ktt_visitor_id");

        if (!visitorId) {
          visitorId = createVisitorId();
          localStorage.setItem("ktt_visitor_id", visitorId);
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        const user = session?.user ?? null;

        const visitorKey = user?.id
          ? `user_${user.id}`
          : `guest_${visitorId}`;

        const response = await fetch("/api/visitor", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            visitorKey,
            userId: user?.id ?? null,
            page: window.location.pathname,
            browserLanguage:
              navigator.language || "unknown",
            deviceOs: detectDeviceOs(),
          }),
          cache: "no-store",
          keepalive: true,
        });

        if (!response.ok) {
          const result = (await response
            .json()
            .catch(() => null)) as
            | { error?: string }
            | null;

          console.error(
            "Visitor tracking API error:",
            result?.error || response.statusText,
          );
        }
      } catch (error) {
        console.error("Visitor tracking error:", error);
      }
    }

    void trackVisit();
  }, []);

  return null;
}