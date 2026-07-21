"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:border-rose-300/50 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <LogOut className="size-3.5" aria-hidden="true" />}
      Log out
    </button>
  );
}
