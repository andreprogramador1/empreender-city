import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getDashUser } from "@/lib/dash-api";


export async function GET(request: Request) {
  const url = new URL(request.url);
  const { searchParams, origin } = url;

  const token = searchParams.get("auth_token_dash_to_sp");
  const nextPath = searchParams.get("next") ?? "";

  if (!token?.trim()) {
    return NextResponse.redirect(`${origin}/?error=no_token`);
  }

  const dashUser = await getDashUser(token.trim());
  if (!dashUser) {
    return NextResponse.redirect(`${origin}/?error=dash_auth_failed`);
  }

  const sb = getSupabaseAdmin();

  const { data: existingProfile } = await sb
    .from("profiles")
    .select("id")
    .eq("dash_user_id", dashUser.id)
    .maybeSingle();

  let supabaseUserId: string;
  let userEmail: string;

  if (existingProfile) {
    supabaseUserId = existingProfile.id;
    const { data: authUser, error: userError } = await sb.auth.admin.getUserById(supabaseUserId);
    if (userError || !authUser?.user?.email) {
      return NextResponse.redirect(`${origin}/?error=auth_failed`);
    }
    userEmail = authUser.user.email;
  } else {
    const { data: created, error: createError } = await sb.auth.admin.createUser({
      email: dashUser.email,
      email_confirm: false,
      user_metadata: {
        full_name: dashUser.name,
        dash_user_id: dashUser.id,
      },
    });

    if (createError) {
      if (createError.message?.toLowerCase().includes("already") || createError.message?.toLowerCase().includes("exists")) {
        return NextResponse.redirect(`${origin}/?error=email_taken`);
      }
      return NextResponse.redirect(`${origin}/?error=create_failed`);
    }
    if (!created?.user?.id) {
      return NextResponse.redirect(`${origin}/?error=create_failed`);
    }

    supabaseUserId = created.user.id;
    userEmail = created.user.email ?? dashUser.email;

    await sb.from("profiles").insert({
      id: supabaseUserId,
      dash_user_id: dashUser.id,
      allow_data_for_buildings: false,
    });
  }

  const confirmUrl =
    origin +
    "/auth/confirm" +
    (nextPath && nextPath != "/" ? `?next=${encodeURIComponent(nextPath.startsWith("/") ? nextPath : `/${nextPath}`)}` : "?next=/settings");

  const { data: linkData, error: linkError } = await sb.auth.admin.generateLink({
    type: "magiclink",
    email: userEmail,
    options: { redirectTo: confirmUrl },
  });

  if (linkError || !linkData?.properties?.action_link) {
    return NextResponse.redirect(`${origin}/?error=magiclink_failed`);
  }

  const actionLink = linkData.properties.action_link as string;
  return NextResponse.redirect(actionLink);
}
