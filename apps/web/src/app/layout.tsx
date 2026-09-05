import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sentinel Ops — autonomous escalation",
  description:
    "Sentinel Ops watches real signals, decides when a failure needs a human, and phones that human through CALL-E.",
};

export const viewport: Viewport = {
  themeColor: "#0A0C10",
  colorScheme: "dark light",
};

/**
 * Dark is the default and the demo theme (§2.1). This runs before paint so a
 * light-mode operator never sees a dark flash, and vice versa.
 */
const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("sentinel.theme");
    document.documentElement.dataset.theme = stored === "light" ? "light" : "dark";
  } catch (e) {
    document.documentElement.dataset.theme = "dark";
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
