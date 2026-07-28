"use client";

import { ReactNode, useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";

type InitialSession = {
  access_token: string;
  refresh_token: string;
};

export default function SessionBootstrap({
  session,
  children,
}: {
  session: InitialSession;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const supabase = createClient();
      const current = await supabase.auth.getSession();

      if (current.data.session?.access_token === session.access_token) {
        if (active) setReady(true);
        return;
      }

      const result = await supabase.auth.setSession(session);
      if (!active) return;

      if (result.error || !result.data.session) {
        setError(result.error?.message ?? "Unable to initialise your secure session.");
        return;
      }

      setReady(true);
    }

    bootstrap().catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : "Unable to initialise your secure session.");
    });

    return () => {
      active = false;
    };
  }, [session.access_token, session.refresh_token]);

  if (error) {
    return (
      <main className="auth-page">
        <section className="auth-panel">
          <div className="login-card">
            <h2>Session could not be started</h2>
            <p>{error}</p>
            <a className="sign-in-button" href="/auth/signout?return_to=/login">Sign in again</a>
          </div>
        </section>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="auth-page">
        <section className="auth-panel">
          <div className="login-card">
            <h2>Opening your secure workspace…</h2>
            <p>Please wait while Fiscara restores your encrypted session.</p>
          </div>
        </section>
      </main>
    );
  }

  return children;
}
