"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import InstallAppButton from "./InstallAppButton";

export default function MainInstallAppButton() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  /*
   * 서버 렌더링 또는 hydration 중에는 경로 판단이 완전히 끝나지 않았을 수
   * 있으므로 메인 설치 버튼을 먼저 렌더링하지 않습니다.
   */
  if (!mounted) {
    return null;
  }

  const currentPath =
    pathname || window.location.pathname || "";

  const isBusinessWebsite =
    /^\/business(?:es)?\/\d+\/website(?:\/|$)/i.test(
      currentPath,
    );

  /*
   * 비즈니스 웹사이트에는 페이지 내부에 다음 버튼이 따로 있습니다.
   *
   * <InstallAppButton businessName={businessName} />
   *
   * 따라서 RootLayout의 메인 버튼은 절대로 실행하지 않습니다.
   */
  if (isBusinessWebsite) {
    return null;
  }

  return <InstallAppButton />;
}