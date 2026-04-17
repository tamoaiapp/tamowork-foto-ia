import type { Metadata, Viewport } from "next";
import { I18nProvider } from "@/lib/i18n";
import DesktopSidebar from "@/app/components/DesktopSidebar";
import ReviewPopup from "@/app/components/ReviewPopup";
import "./globals.css";

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
      <body
        style={{
          background: "#07080b",
          color: "#eef2f9",
          margin: 0,
          fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
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
          // Bloqueia pull-to-refresh no iOS/Android sem quebrar o scroll normal
          (function() {
            var startY = 0;
            var pickerOpen = false;

            // Detecta quando input[type=file] é ativado (galeria nativa abre)
            document.addEventListener('click', function(e) {
              var el = e.target;
              while (el) {
                if (el.tagName === 'INPUT' && el.type === 'file') {
                  pickerOpen = true;
                  function onFocus() {
                    pickerOpen = false;
                    window.removeEventListener('focus', onFocus);
                  }
                  window.addEventListener('focus', onFocus);
                  break;
                }
                el = el.parentElement;
              }
            }, true);

            document.addEventListener('touchstart', function(e) {
              startY = e.touches[0].clientY;
            }, { passive: true });

            document.addEventListener('touchmove', function(e) {
              var dy = e.touches[0].clientY - startY;
              // Dedo movendo para cima = scrolling para baixo = nunca bloquear
              if (!pickerOpen && dy <= 0) return;
              // Dedo movendo para baixo = potencial pull-to-refresh
              // Verifica se algum container ancestral ainda pode scrollar para cima
              var target = e.target;
              while (target && target !== document.body) {
                var style = window.getComputedStyle(target);
                var ov = style.overflowY;
                if ((ov === 'auto' || ov === 'scroll') && target.scrollTop > 0) {
                  return; // Container tem conteúdo acima — deixa scrollar normalmente
                }
                target = target.parentElement;
              }
              e.preventDefault(); // No topo — bloqueia pull-to-refresh
            }, { passive: false });
          })();
        `}} />
      </body>
    </html>
  );
}
