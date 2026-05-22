import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "KTown Triangle",

  description:
    "Events, deals and Korean places around the Triangle",

  manifest: "/manifest.webmanifest",

  themeColor: "#172033",

  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KTT",
  },

  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
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
      <body
        className="
          min-h-screen
          overflow-hidden
          bg-[#F8F3EC]
        "
      >
        {children}
      </body>
    </html>
  );
}
