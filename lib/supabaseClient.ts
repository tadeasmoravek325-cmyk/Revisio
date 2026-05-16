"use client";

type SupabaseModule = {
  createClient: (url: string, anonKey: string, options?: Record<string, unknown>) => unknown;
};

let supabaseClient: unknown;
const cookieMaxAgeSeconds = 60 * 60 * 24 * 30;

async function loadSupabaseModule(): Promise<SupabaseModule> {
  const dynamicImport = new Function("url", "return import(url)") as (url: string) => Promise<SupabaseModule>;
  return dynamicImport("https://esm.sh/@supabase/supabase-js@2.75.0");
}

export async function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient as any;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables are missing.");
  }

  const { createClient } = await loadSupabaseModule();
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: {
        getItem(key: string) {
          if (typeof document === "undefined") {
            return null;
          }

          const item = document.cookie
            .split("; ")
            .find((cookie) => cookie.startsWith(`${key}=`));

          return item ? decodeURIComponent(item.slice(key.length + 1)) : null;
        },
        setItem(key: string, value: string) {
          if (typeof document === "undefined") {
            return;
          }

          const secure = window.location.protocol === "https:" ? "; Secure" : "";
          document.cookie = `${key}=${encodeURIComponent(value)}; Path=/; Max-Age=${cookieMaxAgeSeconds}; SameSite=Lax${secure}`;
        },
        removeItem(key: string) {
          if (typeof document === "undefined") {
            return;
          }

          document.cookie = `${key}=; Path=/; Max-Age=0; SameSite=Lax`;
        }
      }
    }
  });

  return supabaseClient as any;
}
