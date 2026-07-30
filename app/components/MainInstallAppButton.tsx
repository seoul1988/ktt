"use client";

import { usePathname } from "next/navigation";

import InstallAppButton from "./InstallAppButton";

export default function MainInstallAppButton() {
  const pathname = usePathname();

  /*
   * 비즈니스 웹사이트에는 해당 비즈니스 이름과 manifest를 사용하는
   * 전용 InstallAppButton이 페이지 안에서 따로 렌더링됩니다.
   *
   * RootLayout의 메인 설치 버튼까지 함께 렌더링되면
   * 설치 안내가 두 번 표시되므로 비즈니스 웹 경로에서는 숨깁니다.
   */
  const isBusinessWebsite =
    /^\/business(?:es)?\/\d+\/website(?:\/|$)/.test(
      pathname || "",
    );

  if (isBusinessWebsite) {
    return null;
  }

  return <InstallAppButton />;
}