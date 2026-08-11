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

export const viewport: Viewport = {
  themeColor: "#F8F3EC",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
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
        backgroundColor: "#F8F3EC",
        touchAction: "auto",
      }}
      suppressHydrationWarning
    >
      <body
        className="min-h-[100dvh] w-full max-w-[100vw] overflow-x-hidden bg-[#F8F3EC] text-[#172033]"
        style={{
          backgroundColor: "#F8F3EC",
          touchAction: "auto",
        }}
      >
        <AuthProvider>
          <ServiceWorkerRegister />

          {/*
           * 메인 KTown 페이지에서만 설치 버튼을 표시합니다.
           * /business/[id]/website 페이지에서는 비즈니스 전용
           * InstallAppButton을 사용하므로 여기서는 자동으로 숨깁니다.
           */}
          <MainInstallAppButton />

          {/*
           * Instagram, Facebook, Threads는 영어 안내
           * KakaoTalk은 한글 안내
           * Chrome/Safari는 안내 없음
           */}
          <InAppBrowserNotice />

          <VisitorTracker />
          <AppBadgeManager />
          <AppUpdateNotice />

          {/* 공용 팝업 */}
          <KTownPopupBanner />

          {/*
           * 중요:
           * RootLayout 전체에 app-safe-area를 씌우지 않습니다.
           * BottomNav 자체에서 safe-area를 처리합니다.
           */}
          {children}
        </AuthProvider>

        {/* Google Analytics 4 and Google Ads */}
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