import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getDeveloperOwnedByUser } from "@/lib/api-developer";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { github_login?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const githubLogin = body.github_login;
  if (!githubLogin || typeof githubLogin !== "string") {
    return NextResponse.json({ error: "github_login is required in body" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const dev = await getDeveloperOwnedByUser<{ id: number }>(sb, user.id, githubLogin, "id");
  if (!dev) {
    return NextResponse.json({ error: "Developer not found or not yours" }, { status: 403 });
  }

  await sb
    .from("developer_achievements")
    .update({ seen: true })
    .eq("developer_id", dev.id)
    .eq("seen", false);

  return NextResponse.json({ ok: true });
}
