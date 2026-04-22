"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const AFFILIATE_CODE_KEY = "tw_affiliate_code";
const AFFILIATE_VISITOR_KEY = "tw_affiliate_visitor_id";

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
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      claimReferral();
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return null;
}
