"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { signUpSchema } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";

type Stage = "form" | "submitting" | "check-email";

export function SignupForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("form");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = signUpSchema.safeParse({ fullName, email, password, confirmPassword });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setStage("submitting");
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { full_name: parsed.data.fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setFormError(error.message);
      setStage("form");
      return;
    }

    if (data.session && data.user) {
      // Email confirmation is disabled on this project — we already have an
      // active session, so create the profile now and go straight in.
      const { error: profileError } = await ensureProfile(supabase, data.user.id, parsed.data.fullName);
      if (profileError) {
        setFormError(profileError);
        setStage("form");
        return;
      }
      router.push("/onboarding");
      router.refresh();
      return;
    }

    // No session yet — email confirmation is required.
    setStage("check-email");
  }

  if (stage === "check-email") {
    return (
      <div className="animate-fade-in-up rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-cyan-300/10 text-cyan-200">
          <Mail className="size-6" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-100">Check your email</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-400">
          We sent a confirmation link to <span className="text-slate-200">{email}</span>. Click it to finish creating
          your account.
        </p>
      </div>
    );
  }

  const isSubmitting = stage === "submitting";

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
      <div>
        <label htmlFor="fullName" className="text-sm font-medium text-slate-300">
          Full name
        </label>
        <input
          id="fullName"
          type="text"
          autoComplete="name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          disabled={isSubmitting}
          aria-invalid={Boolean(fieldErrors.fullName)}
          aria-describedby={fieldErrors.fullName ? "fullName-error" : undefined}
          className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300"
        />
        {fieldErrors.fullName && (
          <p id="fullName-error" className="mt-1 text-xs text-rose-300">
            {fieldErrors.fullName}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="text-sm font-medium text-slate-300">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isSubmitting}
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
          className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300"
        />
        {fieldErrors.email && (
          <p id="email-error" className="mt-1 text-xs text-rose-300">
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="text-sm font-medium text-slate-300">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isSubmitting}
          aria-invalid={Boolean(fieldErrors.password)}
          aria-describedby={fieldErrors.password ? "password-error" : undefined}
          className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300"
        />
        {fieldErrors.password && (
          <p id="password-error" className="mt-1 text-xs text-rose-300">
            {fieldErrors.password}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-300">
          Confirm password
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          disabled={isSubmitting}
          aria-invalid={Boolean(fieldErrors.confirmPassword)}
          aria-describedby={fieldErrors.confirmPassword ? "confirmPassword-error" : undefined}
          className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300"
        />
        {fieldErrors.confirmPassword && (
          <p id="confirmPassword-error" className="mt-1 text-xs text-rose-300">
            {fieldErrors.confirmPassword}
          </p>
        )}
      </div>

      {formError && (
        <p className="text-sm text-rose-300" role="alert">
          {formError}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="w-full justify-center gap-2">
        {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {isSubmitting ? "Creating your account…" : "Create account"}
      </Button>
    </form>
  );
}
