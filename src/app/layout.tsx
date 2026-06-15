import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";

import "./globals.css";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { brand } from "@/config/brand";
import { getLocale } from "@/lib/i18n/server";

// Kita theme fonts: Fredoka (display/headings) + Nunito (body).
const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: brand.name,
    template: `%s · ${brand.name}`,
  },
  description: brand.tagline,
  // Belt-and-suspenders with the global X-Robots-Tag header and robots.ts.
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: brand.name, statusBarStyle: "default" },
};

/**
 * Viewport + theme. `viewport-fit=cover` is REQUIRED for the CSS
 * env(safe-area-inset-*) values to resolve to non-zero on notched iPhones —
 * without it the app shell would draw under the notch / home indicator in an
 * installed standalone PWA. themeColor matches the paper-toned sticky header so
 * the mobile status bar tints to the app instead of a mismatched dark bar.
 */
export const viewport: Viewport = {
  themeColor: "#f7f6f3", // --app-bg
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Resolve the UI locale once on the server; the (app) provider derives the same
  // value, so the <html lang> and client hydration agree.
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${fredoka.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col text-ink">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
