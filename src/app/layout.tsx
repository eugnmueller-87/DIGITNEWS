import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";

import "./globals.css";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { brand } from "@/config/brand";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${fredoka.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col text-ink">
        {/* Decorative drifting clouds (reduced-motion safe). */}
        <div className="cloud c1" aria-hidden="true" />
        <div className="cloud c2" aria-hidden="true" />
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
