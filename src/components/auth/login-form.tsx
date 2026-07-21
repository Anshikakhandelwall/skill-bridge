"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getPostLoginRedirectPath } from "@/lib/auth/redirect-path";
import { signInSchema } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

    if (error) {
      setFormError(error.message);
      setIsSubmitting(false);
      return;
    }
    if (!data.user) {
      setFormError("Something went wrong. Please try again.");
      setIsSubmitting(false);
      return;
    }

    const redirectPath = await getPostLoginRedirectPath(supabase, data.user.id);
    router.push(redirectPath);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
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
          autoComplete="current-password"
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

      {formError && (
        <p className="text-sm text-rose-300" role="alert">
          {formError}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="w-full justify-center gap-2">
        {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {isSubmitting ? "Signing in…" : "Log in"}
      </Button>
    </form>
  );
}
