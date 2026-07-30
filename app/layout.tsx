import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";

import { AuthProvider } from "./components/AuthProvider";
import InAppBrowserNotice from "./components/InAppBrowserNotice";
import VisitorTracker from "./components/VisitorTracker";
import ServiceWorkerRegister from "./components/ServiceWorkerRegister";
import AppBadgeManager from "./components/AppBadgeManager";
import AppUpdateNotice from "./components/AppUpdateNotice";
import InstallAppButton from "./components/InstallAppButton";

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
      <head>
        <link
          rel="apple-touch-startup-image"
          href="/ios-splash-1242x2208.png"
          media="(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)"
        />
      </head>

      <body
        className="min-h-[100dvh] w-full max-w-[100vw] overflow-x-hidden bg-[#F8F3EC] text-[#172033]"
        style={{
          backgroundColor: "#F8F3EC",
          touchAction: "auto",
        }}
      >
        <AuthProvider>
          <ServiceWorkerRegister />

          {/* 설치되지 않은 일반 브라우저에서만 설치 버튼 표시 */}
          <InstallAppButton />

          {/* Instagram, Facebook, Threads는 영어 안내
              KakaoTalk은 한글 안내
              Chrome/Safari는 안내 없음 */}
          <InAppBrowserNotice />

          <VisitorTracker />
          <AppBadgeManager />
          <AppUpdateNotice />

          <div
            className="app-safe-area"
            style={{
              touchAction: "auto",
            }}
          >
            {children}
          </div>
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