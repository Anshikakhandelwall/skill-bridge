import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reuses the existing onboarding-completion signal: a career_twins row is
 * only ever upserted when the onboarding flow's final "completed" step
 * runs (see POST /api/onboarding). So its presence/absence is exactly
 * "has this user finished onboarding" — no separate flag needed.
 */
export async function getPostLoginRedirectPath(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data: twin } = await supabase.from("career_twins").select("profile_id").eq("profile_id", userId).maybeSingle();
  return twin ? "/dashboard" : "/onboarding";
}
