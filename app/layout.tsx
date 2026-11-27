import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, Space_Grotesk } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { I18nProvider } from "@/lib/i18n";
import { BASE_PATH, STATIC_DEMO } from "@/lib/demo/static";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-grotesk", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Open Social Listening", template: "%s · Open Social Listening" },
  description: "Self-hosted social listening for Reddit, X, YouTube, TikTok, news and the web, powered by the SocQ API.",
  // A self-hosted install stays out of search engines; the public static demo is meant to be found.
  robots: STATIC_DEMO ? { index: true, follow: true } : { index: false, follow: false },
  // Metadata URLs are not prefixed with basePath, which the static demo is served under.
  icons: { icon: `${BASE_PATH}/icon.svg` },
};

export const viewport: Viewport = {
  themeColor: "#f6f6f3",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable}`}>
      <body>
        <I18nProvider>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
