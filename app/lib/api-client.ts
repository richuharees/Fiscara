import { createClient } from "../../lib/supabase/client";

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);

  if (data.session?.access_token) {
    headers.set("authorization", `Bearer ${data.session.access_token}`);
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });
}
