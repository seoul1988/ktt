import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "./components/AuthProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.ktowntriangle.com"),

  verification: {
    google: "iR2pfx7u3jwkOi6orVonKRlv_dlVaHlzOKpuid79rtw",
  },

  title: {
    default: "KTown Triangle",
    template: "%s | KTown Triangle",
  },

  description:
    "Korean restaurants, markets, events, deals, and local businesses around Raleigh, Durham, Cary, Chapel Hill, and the Triangle area.",

  manifest: "/manifest.webmanifest",

  openGraph: {
    title: "KTown Triangle",
    description:
      "Korean restaurants, markets, events, deals, and local businesses around Raleigh, Durham, Cary, Chapel Hill, and the Triangle area.",
    url: "https://www.ktowntriangle.com",
    siteName: "KTown Triangle",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "KTown Triangle",
      },
    ],
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "KTown Triangle",
    description:
      "Korean restaurants, markets, events, deals, and local businesses around Raleigh, Durham, Cary, Chapel Hill, and the Triangle area.",
    images: ["/og-image.png"],
  },

  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
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
    apple: {
      url: "/apple-touch-icon.png",
      sizes: "180x180",
      type: "image/png",
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#172033",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh overflow-x-hidden bg-[#F8F3EC] text-[#172033]">
        <AuthProvider>{children}</AuthProvider>

        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-SDZ3B9B4S6"
          strategy="afterInteractive"
        />

        <Script id="google-tag" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-SDZ3B9B4S6');
            gtag('config', 'AW-18242391009');
          `}
        </Script>
      </body>
    </html>
  );
}