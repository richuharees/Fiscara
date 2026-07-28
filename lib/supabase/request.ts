import { createClient as createSupabaseClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { createClient as createCookieClient } from "./server";

export type AuthenticatedRequestContext = {
  supabase: SupabaseClient;
  user: User | null;
};

export async function getRequestContext(request?: Request): Promise<AuthenticatedRequestContext> {
  const cookieClient = await createCookieClient();
  const { data: cookieAuth } = await cookieClient.auth.getUser();

  if (cookieAuth.user) {
    return { supabase: cookieClient, user: cookieAuth.user };
  }

  const authorization = request?.headers.get("authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) {
    return { supabase: cookieClient, user: null };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return { supabase: cookieClient, user: null };
  }

  const tokenClient = createSupabaseClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: tokenAuth } = await tokenClient.auth.getUser(token);
  return { supabase: tokenClient, user: tokenAuth.user ?? null };
}
