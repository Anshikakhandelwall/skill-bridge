import Link from "next/link";
import { redirect } from "next/navigation";
import { Compass } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPostLoginRedirectPath } from "@/lib/auth/redirect-path";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(await getPostLoginRedirectPath(supabase, user.id));

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 py-12 text-slate-50">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 font-semibold tracking-tight">
          <span className="grid size-8 place-items-center rounded-lg bg-cyan-400 text-slate-950">
            <Compass className="size-5" aria-hidden="true" />
          </span>
          SkillBridge AI
        </Link>

        <h1 className="text-center text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1.5 text-center text-sm text-slate-400">Log in to continue your career roadmap.</p>

        <div className="mt-6">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-sm text-slate-400">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-cyan-200 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
