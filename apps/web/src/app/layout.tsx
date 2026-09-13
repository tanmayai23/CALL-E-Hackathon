import type { Metadata, Viewport } from "next";
import { EB_Garamond, Figtree, Geist_Mono } from "next/font/google";
import "./globals.css";

/* Display serif for headlines and large figures. */
const garamond = EB_Garamond({
  variable: "--font-garamond",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

/* Interface face for everything that is not a headline or a live number. */
const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });

/* Live data — monospace + tabular so changing values never reflow. */
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sentinel Ops — wholesale coordination on CALL-E",
  description:
    "Sentinel Ops calls the wholesaler, negotiates stock and dispatch, and writes the commitment back to the order.",
};

export const viewport: Viewport = {
  themeColor: "#FFFFEB",
  colorScheme: "light dark",
};

/**
 * Cream is the default and the demo theme. This runs before paint so an
 * operator who chose dark never sees a cream flash, and vice versa.
 */
const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("sentinel.theme");
    document.documentElement.dataset.theme = stored === "dark" ? "dark" : "light";
  } catch (e) {
    document.documentElement.dataset.theme = "light";
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${garamond.variable} ${figtree.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
