import type { Metadata, Viewport } from "next";
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

  title: "KTown Triangle",
  description: "Events, deals and Korean places around the Triangle",

  manifest: "/manifest.webmanifest",

  openGraph: {
    title: "KTown Triangle",
    description:
      "Korean food, events, deals, restaurants, markets, and local businesses around the Triangle.",
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
      "Korean food, events, deals, restaurants, markets, and local businesses around the Triangle.",
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
  themeColor: "#172033",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen bg-[#F8F3EC]">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}