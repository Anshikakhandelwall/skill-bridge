import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Creates the profiles row for a newly authenticated user if it doesn't
 * already exist. Safe to call more than once — a unique-violation (23505)
 * on the primary key just means the profile already exists and is ignored.
 * This is the same insert the app has always done right after first auth;
 * it's centralized here so both the confirmation-link callback and the
 * direct (no-confirmation) signup path use exactly one implementation.
 */
export async function ensureProfile(
  supabase: SupabaseClient,
  userId: string,
  fullName: string | null,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("profiles").insert({ id: userId, full_name: fullName });
  if (error && error.code !== "23505") {
    return { error: error.message };
  }
  return { error: null };
}
