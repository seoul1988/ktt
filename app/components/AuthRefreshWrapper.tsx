"use client";

import { useEffect, useState } from "react";

export default function AuthRefreshWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const [key, setKey] = useState(0);

  useEffect(() => {
    function refresh() {
      setKey((prev) => prev + 1);
    }

    window.addEventListener("pageshow", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return <div key={key}>{children}</div>;
}