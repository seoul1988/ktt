import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";

import { AuthProvider } from "./components/AuthProvider";
import InAppBrowserNotice from "./components/InAppBrowserNotice";
import VisitorTracker from "./components/VisitorTracker";
import ServiceWorkerRegister from "./components/ServiceWorkerRegister";
import AppBadgeManager from "./components/AppBadgeManager";
import AppUpdateNotice from "./components/AppUpdateNotice";
import MainInstallAppButton from "./components/MainInstallAppButton";
import KTownPopupBanner from "./components/KTownPopupBanner";

/*
 * 실제 createClient 파일 위치에 맞게 수정
 * 예:
 * import { createClient } from "@/lib/supabase/server";
 */
import { createClient } from "@/lib/supabase/server";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const KTOWN_SITE_URL =
  "https://www.ktowntriangle.com";

const KTOWN_OG_IMAGE_URL =
  `${KTOWN_SITE_URL}/og-image-korean-town.png`;

const GA_MEASUREMENT_ID =
  "G-SDZ3B9B4S6";

const GOOGLE_ADS_ID =
  "AW-18242391009";


/* =========================================================
   HOSTNAME NORMALIZER
========================================================= */

function normalizeHostname(
  rawHost: string,
) {
  return rawHost
    .split(",")[0]
    .trim()
    .split(":")[0]
    .toLowerCase()
    .replace(/^www\./, "");
}


/* =========================================================
   KTOWN DEFAULT METADATA
========================================================= */

function getKTownMetadata(): Metadata {
  return {
    metadataBase:
      new URL(KTOWN_SITE_URL),

    verification: {
      google:
        "iR2pfx7u3jwkOi6orVonKRlv_dlVaHlzOKpuid79rtw",
    },

    title: {
      default: "KTown Triangle",
      template:
        "%s | KTown Triangle",
    },

    description:
      "Discover Korean BBQ, bakeries, fried chicken, K-POP, events, shopping, deals, and everything Korean across Raleigh, Cary, Durham, Chapel Hill, and the Triangle.",

    applicationName:
      "KTown Triangle",

    manifest:
      "/manifest.webmanifest",

    alternates: {
      canonical:
        KTOWN_SITE_URL,
    },

    openGraph: {
      title:
        "Discover Korean Town in the Triangle | KTown Triangle",

      description:
        "Find Korean BBQ, bakeries, fried chicken, K-POP, events, shopping, deals, and everything Korean across Raleigh, Cary, Durham, Chapel Hill, and the Triangle.",

      url:
        KTOWN_SITE_URL,

      siteName:
        "KTown Triangle",

      locale:
        "en_US",

      alternateLocale: [
        "ko_KR",
      ],

      type:
        "website",

      images: [
        {
          url:
            KTOWN_OG_IMAGE_URL,

          secureUrl:
            KTOWN_OG_IMAGE_URL,

          width:
            1200,

          height:
            630,

          alt:
            "Discover Korean BBQ, K-POP, Events and More with KTown Triangle",

          type:
            "image/png",
        },
      ],
    },

    twitter: {
      card:
        "summary_large_image",

      title:
        "Discover Korean Town in the Triangle | KTown Triangle",

      description:
        "Explore Korean BBQ, bakeries, fried chicken, K-POP, events, shopping, local deals, and everything Korean in one place.",

      images: [
        {
          url:
            KTOWN_OG_IMAGE_URL,

          alt:
            "Discover Korean BBQ, K-POP, Events and More with KTown Triangle",
        },
      ],
    },

    appleWebApp: {
      capable:
        true,

      statusBarStyle:
        "default",

      title:
        "KTT",
    },

    icons: {
      icon: [
        {
          url:
            "/favicon.png",

          sizes:
            "32x32",

          type:
            "image/png",
        },

        {
          url:
            "/icon-192.png",

          sizes:
            "192x192",

          type:
            "image/png",
        },

        {
          url:
            "/icon-512.png",

          sizes:
            "512x512",

          type:
            "image/png",
        },
      ],

      shortcut: [
        {
          url:
            "/favicon.png",

          sizes:
            "32x32",

          type:
            "image/png",
        },
      ],

      apple: [
        {
          url:
            "/apple-touch-icon.png",

          sizes:
            "180x180",

          type:
            "image/png",
        },

        {
          url:
            "/icon-192.png",

          sizes:
            "192x192",

          type:
            "image/png",
        },
      ],
    },

    other: {
      "mobile-web-app-capable":
        "yes",

      "apple-mobile-web-app-capable":
        "yes",

      "apple-mobile-web-app-status-bar-style":
        "default",

      "apple-mobile-web-app-title":
        "KTT",

      "format-detection":
        "telephone=no",
    },
  };
}


/* =========================================================
   DYNAMIC METADATA
========================================================= */

export async function generateMetadata():
  Promise<Metadata> {

  const headersList =
    await headers();

  const rawHost =
    headersList.get(
      "x-forwarded-host",
    ) ||
    headersList.get(
      "host",
    ) ||
    "";

  const hostname =
    normalizeHostname(
      rawHost,
    );


  /*
   * KTown 도메인이면
   * DB 조회하지 않고 바로 기본 metadata 반환
   */
  if (
    hostname ===
      "ktowntriangle.com" ||
    hostname ===
      "localhost"
  ) {
    return getKTownMetadata();
  }


  try {
    const supabase =
      await createClient();

    /*
     * DB custom_domain에는
     * www 없이 저장하는 것을 권장합니다.
     *
     * 예:
     * bunsofchapelhill.com
     */
    const {
      data: business,
      error,
    } =
      await supabase
        .from("businesses")
        .select(`
          id,
          name,
          description,
          custom_domain,
          slider_image_urls
        `)
        .eq(
          "custom_domain",
          hostname,
        )
        .maybeSingle();


    if (
      error ||
      !business
    ) {
      /*
       * 등록되지 않은 도메인이면
       * 안전하게 KTown metadata
       */
      return getKTownMetadata();
    }


    const businessUrl =
      `https://${hostname}`;


    /*
     * slider_image_urls가
     * string[] 기준
     */
    const sliderImages =
      Array.isArray(
        business.slider_image_urls,
      )
        ? business.slider_image_urls
        : [];


    const firstImage =
      typeof sliderImages[0] ===
        "string"
        ? sliderImages[0]
        : null;


    /*
     * 업체 이미지가 없으면
     * KTown 기본 이미지 사용
     */
    const ogImage =
      firstImage ||
      KTOWN_OG_IMAGE_URL;


    const businessName =
      business.name ||
      "Local Business";


    const businessDescription =
      business.description?.trim() ||
      `${businessName} in the Triangle area of North Carolina.`;


    return {
      metadataBase:
        new URL(
          businessUrl,
        ),

      title: {
        default:
          businessName,

        template:
          `%s | ${businessName}`,
      },

      description:
        businessDescription,

      applicationName:
        businessName,

      alternates: {
        canonical:
          `${businessUrl}/`,
      },

      openGraph: {
        title:
          businessName,

        description:
          businessDescription,

        url:
          `${businessUrl}/`,

        siteName:
          businessName,

        locale:
          "en_US",

        type:
          "website",

        images: [
          {
            url:
              ogImage,

            alt:
              businessName,
          },
        ],
      },

      twitter: {
        card:
          "summary_large_image",

        title:
          businessName,

        description:
          businessDescription,

        images: [
          {
            url:
              ogImage,

            alt:
              businessName,
          },
        ],
      },

      icons: {
        icon: [
          {
            url:
              "/favicon.png",
          },
        ],

        apple: [
          {
            url:
              "/apple-touch-icon.png",
          },
        ],
      },

      other: {
        "format-detection":
          "telephone=no",
      },
    };
  } catch (
    error
  ) {
    console.error(
      "generateMetadata domain lookup failed:",
      error,
    );

    return getKTownMetadata();
  }
}


/* =========================================================
   VIEWPORT
========================================================= */

export const viewport:
  Viewport = {

  themeColor:
    "#F8F3EC",

  width:
    "device-width",

  initialScale:
    1,

  minimumScale:
    1,

  maximumScale:
    5,

  userScalable:
    true,

  viewportFit:
    "cover",
};


/* =========================================================
   ROOT LAYOUT
========================================================= */

export default function RootLayout({
  children,
}: Readonly<{
  children:
    React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full bg-[#F8F3EC] antialiased`}
      style={{
        backgroundColor:
          "#F8F3EC",

        touchAction:
          "auto",
      }}
      suppressHydrationWarning
    >
      <body
        className="min-h-[100dvh] w-full max-w-[100vw] overflow-x-hidden bg-[#F8F3EC] text-[#172033]"
        style={{
          backgroundColor:
            "#F8F3EC",

          touchAction:
            "auto",
        }}
      >
        <Script
          id="pwa-refresh-on-resume"
          strategy="afterInteractive"
        >
          {`
            (() => {
              if (!("serviceWorker" in navigator)) {
                return;
              }

              let wasHidden = false;
              let refreshing = false;

              const updateServiceWorker = async () => {
                try {
                  const registration =
                    await navigator.serviceWorker.getRegistration();

                  if (registration) {
                    await registration.update();
                  }
                } catch (error) {
                  console.error(
                    "PWA update check failed:",
                    error
                  );
                }
              };

              const refreshInstalledApp = async () => {
                if (refreshing) {
                  return;
                }

                refreshing = true;

                await updateServiceWorker();

                window.location.reload();
              };

              document.addEventListener(
                "visibilitychange",
                () => {
                  if (
                    document.visibilityState ===
                    "hidden"
                  ) {
                    wasHidden = true;
                    return;
                  }

                  if (
                    document.visibilityState ===
                      "visible" &&
                    wasHidden
                  ) {
                    wasHidden = false;
                    refreshInstalledApp();
                  }
                }
              );

              window.addEventListener(
                "pageshow",
                (event) => {
                  if (event.persisted) {
                    refreshInstalledApp();
                  }
                }
              );

              updateServiceWorker();
            })();
          `}
        </Script>
        <AuthProvider>
          <ServiceWorkerRegister />

          <MainInstallAppButton />

          <InAppBrowserNotice />

          <VisitorTracker />

          <AppBadgeManager />

          <AppUpdateNotice />

          <KTownPopupBanner />

          <div
            className="app-safe-area"
            style={{
              touchAction:
                "auto",
            }}
          >
            {children}
          </div>
        </AuthProvider>

        <Script
          id="google-tag-manager"
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />

        <Script
          id="google-analytics-and-ads"
          strategy="afterInteractive"
        >
          {`
            window.dataLayer =
              window.dataLayer || [];

            function gtag() {
              window.dataLayer.push(
                arguments
              );
            }

            window.gtag = gtag;

            gtag(
              "js",
              new Date()
            );

            gtag(
              "config",
              "${GA_MEASUREMENT_ID}",
              {
                send_page_view: true
              }
            );

            gtag(
              "config",
              "${GOOGLE_ADS_ID}"
            );
          `}
        </Script>
      </body>
    </html>
  );
}