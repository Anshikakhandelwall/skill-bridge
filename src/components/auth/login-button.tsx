"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginButton() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function signInWithGoogle() {
    setError(null);
    setIsLoading(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (signInError) {
      setError(signInError.message);
      setIsLoading(false);
    }
  }

  return <div className="space-y-2"><button className="inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-5 py-3 font-medium text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60" onClick={signInWithGoogle} disabled={isLoading}>{isLoading ? "Connecting…" : "Continue with Google"}</button>{error && <p className="text-sm text-rose-300" role="alert">{error}</p>}</div>;
}
