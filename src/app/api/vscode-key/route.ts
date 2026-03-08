import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getDeveloperOwnedByUser } from "@/lib/api-developer";
import crypto from "crypto";

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const githubLogin = new URL(request.url).searchParams.get("github_login");
  if (!githubLogin) return NextResponse.json({ error: "github_login is required (query)" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const dev = await getDeveloperOwnedByUser<{ id: number }>(sb, user.id, githubLogin, "id");
  if (!dev) return NextResponse.json({ error: "Developer not found or not yours" }, { status: 403 });

  const { data: row } = await sb
    .from("developers")
    .select("vscode_api_key_hash")
    .eq("id", dev.id)
    .single();

  return NextResponse.json({ hasKey: !!row?.vscode_api_key_hash });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

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
  if (!dev) return NextResponse.json({ error: "Developer not found or not yours" }, { status: 403 });

  const newKey = crypto.randomBytes(32).toString("base64url");
  const { error } = await sb
    .from("developers")
    .update({ vscode_api_key_hash: hashKey(newKey) })
    .eq("id", dev.id);

  if (error) {
    return NextResponse.json({ error: "Failed to generate key" }, { status: 500 });
  }

  return NextResponse.json({ key: newKey });
}
