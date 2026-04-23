"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const AFFILIATE_CODE_KEY = "tw_affiliate_code";
const AFFILIATE_VISITOR_KEY = "tw_affiliate_visitor_id";
const FBCLID_KEY = "tw_fbclid";
const UTM_KEY = "tw_utm_source";

function normalizeAffiliateCode(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 24);
}

function getVisitorId() {
  const existing = localStorage.getItem(AFFILIATE_VISITOR_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(AFFILIATE_VISITOR_KEY, created);
  return created;
}

export default function AffiliateAttributionClient() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Captura fbclid e utm_source no landing
  useEffect(() => {
    if (typeof window === "undefined") return;
    const fbclid = searchParams.get("fbclid");
    if (fbclid && !localStorage.getItem(FBCLID_KEY)) {
      localStorage.setItem(FBCLID_KEY, fbclid);
    }
    const utmSource = searchParams.get("utm_source");
    if (utmSource && !localStorage.getItem(UTM_KEY)) {
      localStorage.setItem(UTM_KEY, utmSource);
    }
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const refParam = searchParams.get("ref");
    if (!refParam) return;

    const code = normalizeAffiliateCode(refParam);
    if (!code) return;

    const visitorId = getVisitorId();
    localStorage.setItem(AFFILIATE_CODE_KEY, code);

    const clickKey = `tw_affiliate_click_${code}_${pathname}`;
    if (sessionStorage.getItem(clickKey) === "1") return;

    fetch("/api/affiliates/track-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        visitorId,
        landingPath: `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`,
      }),
    })
      .then((res) => {
        if (res.ok) sessionStorage.setItem(clickKey, "1");
      })
      .catch(() => {});
  }, [pathname, searchParams]);

  useEffect(() => {
    let active = true;

    async function claimReferral() {
      const code = localStorage.getItem(AFFILIATE_CODE_KEY);
      if (!code) return;

      const visitorId = getVisitorId();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const userId = data.session?.user?.id;
      if (!token || !userId || !active) return;

      const claimKey = `tw_affiliate_claimed_${userId}_${code}`;
      if (sessionStorage.getItem(claimKey) === "1") return;

      const res = await fetch("/api/affiliates/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code, visitorId }),
      }).catch(() => null);

      if (res?.ok) {
        sessionStorage.setItem(claimKey, "1");
      }
    }

    claimReferral();

    async function saveAttribution() {
      const fbclid = localStorage.getItem(FBCLID_KEY);
      const utmSource = localStorage.getItem(UTM_KEY);
      if (!fbclid && !utmSource) return;
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const userId = data.session?.user?.id;
      if (!token || !userId) return;
      const claimKey = `tw_attribution_saved_${userId}`;
      if (sessionStorage.getItem(claimKey)) return;
      fetch("/api/attribution/save", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fbclid, utm_source: utmSource }),
      }).then(r => { if (r.ok) sessionStorage.setItem(claimKey, "1"); }).catch(() => {});
    }

    saveAttribution();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      claimReferral();
      saveAttribution();
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return null;
}
