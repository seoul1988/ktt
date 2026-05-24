"use client";

import { useEffect } from "react";
import { supabase } from "../../../lib/supabase";

export default function AuthCallback() {
  useEffect(() => {
    async function completeLogin() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase
          .from("profiles")
          .upsert({
            id: user.id,
            email: user.email,
            role: "user",
            owner_status: "none",
          });
      }

      window.location.href = "/";
    }

    completeLogin();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      Completing login...
    </div>
  );
}