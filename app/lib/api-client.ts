import { createClient } from "../../lib/supabase/client";

let synchronizedAccessToken: string | null = null;
let synchronizationPromise: Promise<boolean> | null = null;

async function synchronizeServerSession(accessToken: string, refreshToken: string) {
  if (synchronizedAccessToken === accessToken) return true;

  if (!synchronizationPromise) {
    synchronizationPromise = fetch("/auth/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        access_token: accessToken,
        refresh_token: refreshToken,
      }),
      credentials: "include",
      cache: "no-store",
    })
      .then((response) => {
        if (response.ok) synchronizedAccessToken = accessToken;
        return response.ok;
      })
      .catch(() => false)
      .finally(() => {
        synchronizationPromise = null;
      });
  }

  return synchronizationPromise;
}

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const supabase = createClient();
  let { data } = await supabase.auth.getSession();

  if (!data.session) {
    const refreshed = await supabase.auth.refreshSession();
    data = refreshed.data;
  }

  const session = data.session;
  const headers = new Headers(init.headers);

  if (session?.access_token) {
    headers.set("authorization", `Bearer ${session.access_token}`);
    await synchronizeServerSession(session.access_token, session.refresh_token);
  }

  let response = await fetch(input, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });

  if (response.status === 401 && session?.access_token) {
    synchronizedAccessToken = null;
    await synchronizeServerSession(session.access_token, session.refresh_token);
    response = await fetch(input, {
      ...init,
      headers,
      credentials: "include",
      cache: "no-store",
    });
  }

  return response;
}
