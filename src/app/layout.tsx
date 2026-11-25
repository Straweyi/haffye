import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { PwaManager } from "@/components/pwa/pwa-manager";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "HAFFYE — Coffee on the Move.",
  description: "Smart mobile coffee platform. Find, order, and pay at the nearest HAFFYE cart.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "HAFFYE",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#3B2418",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${poppins.variable} bg-warm font-sans text-charcoal antialiased`}>
        <PwaManager />
        {children}
      </body>
    </html>
  );
}
