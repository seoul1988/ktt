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

        const { error: insertError } = await supabase
          .from("visitor_logs")
          .insert({
            visitor_key: visitorKey,
            user_id: user?.id ?? null,
            page: window.location.pathname,
            user_agent: navigator.userAgent,
            browser_language: navigator.language || "unknown",
          });

        if (insertError) {
          console.error("Visitor log insert error:", insertError);
        }
      } catch (error) {
        console.error("Visitor tracking error:", error);
      }
    }

    void trackVisit();
  }, []);

  return null;
}