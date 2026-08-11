import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";

import { AuthProvider } from "./components/AuthProvider";
import InAppBrowserNotice from "./components/InAppBrowserNotice";
import VisitorTracker from "./components/VisitorTracker";
import ServiceWorkerRegister from "./components/ServiceWorkerRegister";
import AppBadgeManager from "./components/AppBadgeManager";
import AppUpdateNotice from "./components/AppUpdateNotice";
import MainInstallAppButton from "./components/MainInstallAppButton";
import KTownPopupBanner from "./components/KTownPopupBanner";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://www.ktowntriangle.com";
const OG_IMAGE_URL = `${SITE_URL}/og-image-korean-town.png`;

const GA_MEASUREMENT_ID = "G-SDZ3B9B4S6";
const GOOGLE_ADS_ID = "AW-18242391009";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  verification: {
    google: "iR2pfx7u3jwkOi6orVonKRlv_dlVaHlzOKpuid79rtw",
  },

  title: {
    default: "KTown Triangle",
    template: "%s | KTown Triangle",
  },

  description:
    "Discover Korean BBQ, bakeries, fried chicken, K-POP, events, shopping, deals, and everything Korean across Raleigh, Cary, Durham, Chapel Hill, and the Triangle.",

  applicationName: "KTown Triangle",

  manifest: "/manifest.webmanifest",

  alternates: {
    canonical: SITE_URL,
  },

  openGraph: {
    title: "Discover Korean Town in the Triangle | KTown Triangle",

    description:
      "Find Korean BBQ, bakeries, fried chicken, K-POP, events, shopping, deals, and everything Korean across Raleigh, Cary, Durham, Chapel Hill, and the Triangle.",

    url: SITE_URL,

    siteName: "KTown Triangle",

    locale: "en_US",

    alternateLocale: ["ko_KR"],

    type: "website",

    images: [
      {
        url: OG_IMAGE_URL,
        secureUrl: OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: "Discover Korean BBQ, K-POP, Events and More with KTown Triangle",
        type: "image/png",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",

    title: "Discover Korean Town in the Triangle | KTown Triangle",

    description:
      "Explore Korean BBQ, bakeries, fried chicken, K-POP, events, shopping, local deals, and everything Korean in one place.",

    images: [
      {
        url: OG_IMAGE_URL,
        alt: "Discover Korean BBQ, K-POP, Events and More with KTown Triangle",
      },
    ],
  },

  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KTT",
  },

  icons: {
    icon: [
      {
        url: "/favicon.png",
        sizes: "32x32",
        type: "image/png",
      },

      {
        url: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },

      {
        url: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],

    shortcut: [
      {
        url: "/favicon.png",
        sizes: "32x32",
        type: "image/png",
      },
    ],

    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },

      {
        url: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
  },

  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "KTT",
    "format-detection": "telephone=no",
  },
};

/*
 * 모바일/PWA 화면 크기 고정
 *
 * Android PWA에서 화면이 작게 렌더링된 뒤
 * 사용자가 확대하면서 fixed BottomNav가 화면 밖으로
 * 밀리는 현상을 방지합니다.
 */
export const viewport: Viewport = {
  themeColor: "#F8F3EC",

  width: "device-width",

  initialScale: 1,

  minimumScale: 1,

  maximumScale: 1,

  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full bg-[#F8F3EC] antialiased`}
      style={{
        width: "100%",
        minHeight: "100%",
        backgroundColor: "#F8F3EC",
      }}
      suppressHydrationWarning
    >
      <body
        className="
          min-h-screen
          w-full
          overflow-x-hidden
          bg-[#F8F3EC]
          text-[#172033]
        "
        style={{
          width: "100%",
          minWidth: "100%",
          margin: 0,
          padding: 0,
          backgroundColor: "#F8F3EC",
          overflowX: "hidden",
        }}
      >
        <AuthProvider>
          {/*
           * PWA Service Worker
           */}
          <ServiceWorkerRegister />

          {/*
           * 메인 KTown 설치 버튼
           *
           * /business/[id]/website 페이지에서는
           * 비즈니스 전용 InstallAppButton을 사용합니다.
           */}
          <MainInstallAppButton />

          {/*
           * Instagram / Facebook / Threads
           * → 영어 안내
           *
           * KakaoTalk
           * → 한글 안내
           *
           * 일반 Chrome / Safari
           * → 표시하지 않음
           */}
          <InAppBrowserNotice />

          {/*
           * 방문자 카운트
           */}
          <VisitorTracker />

          {/*
           * 앱 아이콘 Badge
           */}
          <AppBadgeManager />

          {/*
           * PWA 업데이트 안내
           */}
          <AppUpdateNotice />

          {/*
           * 공용 Popup Banner
           */}
          <KTownPopupBanner />

          {/*
           * 중요
           *
           * 예전에 사용했던:
           *
           * <div className="app-safe-area">
           *   {children}
           * </div>
           *
           * 를 사용하지 않습니다.
           *
           * BottomNav가 자체적으로
           * safe-area-inset-bottom을 처리하고 있기 때문에
           * RootLayout에서 다시 적용하면
           * Android PWA에서 화면 계산이 꼬일 수 있습니다.
           */}
          {children}
        </AuthProvider>

        {/*
         * Google Analytics 4
         * Google Ads
         */}
        <Script
          id="google-tag-manager"
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />

        <Script id="google-analytics-and-ads" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];

            function gtag() {
              window.dataLayer.push(arguments);
            }

            window.gtag = gtag;

            gtag("js", new Date());

            gtag("config", "${GA_MEASUREMENT_ID}", {
              send_page_view: true
            });

            gtag("config", "${GOOGLE_ADS_ID}");
          `}
        </Script>
      </body>
    </html>
  );
}