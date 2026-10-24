"use client";

import { useEffect } from "react";
import InstallAppButton from "./InstallAppButton";

type Props = { businessName: string };

// Both entry points share one banner and installation state controller.
export default function InstallBusinessApp({ businessName }: Props) {
  useEffect(() => {
    // Preserve the existing business component's worker registration.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(error => {
        console.error("Service worker registration failed:", error);
      });
    }
  }, []);

  return <InstallAppButton businessName={businessName} />;
}