import type { Metadata, Viewport } from "next";
import { Saira_Condensed, Barlow, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartProvider } from "@/components/CartProvider";
import { siteUrl } from "@/lib/format";

const display = Saira_Condensed({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-display", display: "swap" });
const body = Barlow({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "Frontier TCG — Trading Cards in Laredo, TX", template: "%s · Frontier TCG" },
  description: "Pokémon singles, sealed product, sports cards, accessories and local events in Laredo, Texas. Search our live inventory with the Card Finder.",
  openGraph: { siteName: "Frontier TCG", type: "website", images: ["/logo.png"] },
};

export const viewport: Viewport = { themeColor: "#0a0a0a", colorScheme: "dark", viewportFit: "cover", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <CartProvider>
          <a href="#main" className="sr">Skip to content</a>
          <Header />
          <main id="main" tabIndex={-1}>{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
