import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const purchaseId = searchParams.get("purchase_id");

  if (!purchaseId) {
    return NextResponse.json({ error: "Missing purchase_id" }, { status: 400 });
  }

  // Auth required
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const githubLogin = searchParams.get("github_login");
  if (!githubLogin) {
    return NextResponse.json({ error: "github_login is required (query)" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data: dev } = await sb
    .from("developers")
    .select("id, claimed_by")
    .eq("github_login", githubLogin)
    .single();

  if (!dev || dev.claimed_by !== user.id) {
    return NextResponse.json({ error: "Developer not found or not yours" }, { status: 403 });
  }

  // Fetch purchase — must belong to this developer
  const { data: purchase } = await sb
    .from("purchases")
    .select("status")
    .eq("id", purchaseId)
    .eq("developer_id", dev.id)
    .single();

  if (!purchase) {
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  }

  return NextResponse.json({ status: purchase.status });
}
