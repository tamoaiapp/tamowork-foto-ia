import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { I18nProvider } from "@/lib/i18n";

const outfit = Outfit({ subsets: ["latin"] });
import DesktopSidebar from "@/app/components/DesktopSidebar";
import ReviewPopup from "@/app/components/ReviewPopup";
import "./globals.css";

const SERVICE_WORKER_VERSION = "tamowork-v4";

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
      <body className={outfit.className} style={{ background: "#07080b", color: "#eef2f9", margin: 0 }}>
        <I18nProvider>
          {/* Sidebar — visível só no desktop via CSS */}
          <DesktopSidebar />
          {/* Conteúdo — com margem esquerda no desktop para dar espaço ao sidebar */}
          <div className="app-content">
            {children}
          </div>
          <ReviewPopup />
        </I18nProvider>
        {/* Meta Pixel */}
        <script dangerouslySetInnerHTML={{ __html: `
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
          n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
          document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init','1279506057538215');
          fbq('track','PageView');
        `}} />
        <noscript><img height="1" width="1" style={{display:"none"}} src="https://www.facebook.com/tr?id=1279506057538215&ev=PageView&noscript=1" alt="" /></noscript>

        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var SW_VERSION = '${SERVICE_WORKER_VERSION}';

            function clearTamoworkCaches(keepCurrentVersion) {
              if (!('caches' in window)) return Promise.resolve();
              return caches.keys().then(function(keys) {
                return Promise.all(
                  keys
                    .filter(function(key) {
                      if (key.indexOf('tamowork-') !== 0) return false;
                      if (!keepCurrentVersion) return true;
                      return key !== SW_VERSION;
                    })
                    .map(function(key) {
                      return caches.delete(key);
                    })
                );
              });
            }

            function unregisterAllServiceWorkers() {
              if (!('serviceWorker' in navigator)) return Promise.resolve();
              return navigator.serviceWorker.getRegistrations().then(function(registrations) {
                return Promise.all(
                  registrations.map(function(registration) {
                    return registration.unregister();
                  })
                );
              });
            }

            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                var host = window.location.hostname;
                var isLocal = host === 'localhost' || host === '127.0.0.1';

                if (isLocal) {
                  unregisterAllServiceWorkers()
                    .catch(function() {})
                    .then(function() {
                      return clearTamoworkCaches(false);
                    })
                    .catch(function() {});
                  return;
                }

                clearTamoworkCaches(true)
                  .catch(function() {})
                  .then(function() {
                    return navigator.serviceWorker.register('/sw.js?v=' + encodeURIComponent(SW_VERSION), {
                      updateViaCache: 'none',
                    });
                  })
                  .then(function(registration) {
                    if (registration && typeof registration.update === 'function') {
                      return registration.update();
                    }
                  })
                  .catch(function() {});
              });
            }
          })();

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
