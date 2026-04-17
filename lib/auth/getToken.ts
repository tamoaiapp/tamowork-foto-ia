import { supabase } from "@/lib/supabase/client";

/**
 * Retorna o access token da sessão atual.
 * Se o token estiver prestes a expirar (< 60s), força refresh.
 */
export async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? "";
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.exp && payload.exp * 1000 < Date.now() + 60_000) {
        const { data: r } = await supabase.auth.refreshSession();
        return r.session?.access_token ?? token;
      }
    } catch { /* ignora erro de parse */ }
  }
  return token;
}
