import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { I18nProvider } from "@/lib/i18n";
import DesktopSidebar from "@/app/components/DesktopSidebar";
import ReviewPopup from "@/app/components/ReviewPopup";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "TamoWork Fotos para Produtos",
  description: "Gere fotos profissionais dos seus produtos com IA",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Fotos IA",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={outfit.className} style={{ background: "#07080b", color: "#eef2f9", margin: 0, minHeight: "100vh" }}>
        <I18nProvider>
          {/* Sidebar — visível só no desktop via CSS */}
          <DesktopSidebar />
          {/* Conteúdo — com margem esquerda no desktop para dar espaço ao sidebar */}
          <div className="app-content">
            {children}
          </div>
          <ReviewPopup />
        </I18nProvider>
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('/sw.js');
            });
          }
        `}} />
      </body>
    </html>
  );
}
