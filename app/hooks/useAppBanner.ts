"use client";

import { useEffect, useState } from "react";

/**
 * Detecta plataforma (Android/iOS) e decide se exibe o banner de instalação de app.
 * Não exibe se o app já está instalado como PWA (standalone).
 */
export function useAppBanner() {
  const [appBannerPlatform, setAppBannerPlatform] = useState<"android" | "ios" | null>(null);
  const [appBannerDismissed, setAppBannerDismissed] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent.toLowerCase();
    const isAndroid = /android/.test(ua);
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isStandalone =
      (window.navigator as { standalone?: boolean }).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;

    if (isStandalone) return; // já está como PWA instalado — não mostra banner

    if (isAndroid) {
      const dismissed = localStorage.getItem("app_banner_dismissed_android");
      if (!dismissed) setAppBannerPlatform("android");
    } else if (isIOS) {
      const visited = localStorage.getItem("ios_app_visited");
      if (!visited) setAppBannerPlatform("ios");
    }
  }, []);

  return { appBannerPlatform, setAppBannerPlatform, appBannerDismissed, setAppBannerDismissed };
}
