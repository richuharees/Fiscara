"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

export default function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name.trim() } },
      });
      if (error) setMessage(error.message);
      else if (data.session) {
        router.replace("/dashboard");
        router.refresh();
      } else setMessage("Account created. Check your email to confirm your account.");
      setBusy(false);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }
    const returnTo = searchParams.get("return_to");
    router.replace(returnTo?.startsWith("/") ? returnTo : "/dashboard");
    router.refresh();
  }

  return (
    <form className="fiscara-auth-form" onSubmit={submit}>
      {mode === "signup" && (
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
        </label>
      )}
      <label>
        Email
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
      </label>
      <label>
        Password
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required />
      </label>
      <button className="sign-in-button" type="submit" disabled={busy}>
        <span>✦</span> {busy ? "Please wait…" : mode === "signin" ? "Sign in securely" : "Create my account"}
      </button>
      {message && <p className="auth-message" role="status">{message}</p>}
      <button className="auth-mode-button" type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
        {mode === "signin" ? "New to Fiscara? Create an account" : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
