import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { getPostLoginRedirectPath } from "@/lib/auth/redirect-path";

/**
 * Handles the redirect Supabase sends the browser to after exchanging a
 * PKCE `code` for a session. This fires for both email/password sign-up
 * confirmation links and (if ever re-enabled) OAuth sign-in — the code
 * exchange mechanism is the same either way, so this route is still needed
 * even though Google OAuth itself has been removed from the UI.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) return NextResponse.redirect(new URL("/login?auth_error=missing_code", requestUrl.origin));

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) return NextResponse.redirect(new URL("/login?auth_error=callback_failed", requestUrl.origin));

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return NextResponse.redirect(new URL("/login?auth_error=user_not_found", requestUrl.origin));

  const fullName = typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : null;
  const { error: profileError } = await ensureProfile(supabase, user.id, fullName);
  if (profileError) return NextResponse.redirect(new URL("/login?auth_error=profile_setup_failed", requestUrl.origin));

  const redirectPath = await getPostLoginRedirectPath(supabase, user.id);
  return NextResponse.redirect(new URL(redirectPath, requestUrl.origin));
}
