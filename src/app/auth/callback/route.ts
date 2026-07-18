import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) return NextResponse.redirect(new URL("/?auth_error=missing_code", requestUrl.origin));

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) return NextResponse.redirect(new URL("/?auth_error=callback_failed", requestUrl.origin));

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return NextResponse.redirect(new URL("/?auth_error=user_not_found", requestUrl.origin));

  const fullName = typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : null;
  const { error: profileError } = await supabase.from("profiles").insert({ id: user.id, full_name: fullName });
  if (profileError && profileError.code !== "23505") {
    return NextResponse.redirect(new URL("/?auth_error=profile_setup_failed", requestUrl.origin));
  }

  return NextResponse.redirect(new URL("/onboarding", requestUrl.origin));
}
