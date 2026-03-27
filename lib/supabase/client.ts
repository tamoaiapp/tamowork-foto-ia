"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _client;
}

// Alias para compatibilidade — usar getSupabaseClient() em componentes
export const supabase = {
  get auth() { return getSupabaseClient().auth; },
  get storage() { return getSupabaseClient().storage; },
  from: (...args: Parameters<SupabaseClient["from"]>) => getSupabaseClient().from(...args),
  channel: (...args: Parameters<SupabaseClient["channel"]>) => getSupabaseClient().channel(...args),
  removeChannel: (...args: Parameters<SupabaseClient["removeChannel"]>) => getSupabaseClient().removeChannel(...args),
};
