"use client";

import { useEffect } from "react";

type Props = {
  businessId: string;
};

export default function BusinessServiceWorker({
  businessId,
}: Props) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const workerUrl =
      `/business/${businessId}/website/sw.js`;

    const scope =
      `/business/${businessId}/website/`;

    navigator.serviceWorker
      .register(workerUrl, {
        scope,
      })
      .then((registration) => {
        console.log(
          "Business service worker registered:",
          registration.scope,
        );
      })
      .catch((error) => {
        console.error(
          "Business service worker registration failed:",
          error,
        );
      });
  }, [businessId]);

  return null;
}