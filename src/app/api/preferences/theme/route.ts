import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getDeveloperOwnedByUser } from "@/lib/api-developer";

const MAX_THEME = 3;

/**
 * GET /api/preferences/theme?github_login=...
 */
export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const githubLogin = new URL(request.url).searchParams.get("github_login");
  if (!githubLogin) {
    return NextResponse.json({ error: "github_login is required (query)" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const dev = await getDeveloperOwnedByUser(sb, user.id, githubLogin, "city_theme");
  if (!dev) {
    return NextResponse.json({ city_theme: 0 });
  }

  return NextResponse.json({ city_theme: (dev as { city_theme?: number }).city_theme ?? 0 });
}

/**
 * PATCH /api/preferences/theme
 * Body: { github_login: string, city_theme: number }
 */
export async function PATCH(request: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const theme = body.city_theme;
  const githubLogin = body.github_login;

  if (typeof theme !== "number" || theme < 0 || theme > MAX_THEME || !Number.isInteger(theme)) {
    return NextResponse.json({ error: "Invalid theme index" }, { status: 400 });
  }
  if (!githubLogin || typeof githubLogin !== "string") {
    return NextResponse.json({ error: "github_login is required in body" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const dev = await getDeveloperOwnedByUser<{ id: number }>(sb, user.id, githubLogin, "id");
  if (!dev) {
    return NextResponse.json({ error: "Developer not found or not yours" }, { status: 403 });
  }

  const { error } = await sb
    .from("developers")
    .update({ city_theme: theme })
    .eq("id", dev.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ city_theme: theme });
}
