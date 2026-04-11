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
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
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
          // Bloqueia pull-to-refresh no iOS Safari (overscroll-behavior não funciona no iOS)
          (function() {
            var startY = 0;
            document.addEventListener('touchstart', function(e) {
              startY = e.touches[0].clientY;
            }, { passive: true });
            document.addEventListener('touchmove', function(e) {
              var dy = e.touches[0].clientY - startY;
              var el = document.scrollingElement || document.documentElement;
              if (dy > 0 && el.scrollTop <= 0) {
                e.preventDefault();
              }
            }, { passive: false });
          })();
        `}} />
      </body>
    </html>
  );
}
