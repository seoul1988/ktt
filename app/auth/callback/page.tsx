"use client";

import { useEffect } from "react";
import { supabase } from "../../../lib/supabase";

export default function AuthCallbackPage() {
  useEffect(() => {
    async function handleCallback() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          console.error("OAuth Error:", error);
          alert(error.message);
          window.location.href = "/login";
          return;
        }
      }

      window.location.replace("/");
    }

    handleCallback();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F3EC]">
      <p className="text-lg font-bold">Signing you in...</p>
    </main>
  );
}