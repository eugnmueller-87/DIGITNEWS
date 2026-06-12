"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

/**
 * Browser Supabase client. Uses the ANON key and is subject to RLS — it can
 * only ever do what the logged-in user's policies allow. Safe to use in client
 * components. NEVER holds the service-role key.
 */
export function createClient() {
  return createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
}
