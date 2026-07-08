"use client";

import { useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function VisitorTracker() {
  useEffect(() => {
    async function trackVisit() {
      try {
        let visitorId = localStorage.getItem("ktt_visitor_id");

        if (!visitorId) {
          visitorId = crypto.randomUUID();
          localStorage.setItem("ktt_visitor_id", visitorId);
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        const visitorKey = user?.id ? `user_${user.id}` : `guest_${visitorId}`;

        await supabase.from("visitor_logs").insert({
          visitor_key: visitorKey,
          user_id: user?.id || null,
          page: window.location.pathname,
          user_agent: navigator.userAgent,
        });
      } catch (error) {
        console.error("Visitor tracking error:", error);
      }
    }

    trackVisit();
  }, []);

  return null;
}