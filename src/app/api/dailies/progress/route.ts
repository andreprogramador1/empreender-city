import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";
import { getDeveloperOwnedByUser } from "@/lib/api-developer";
import { getDailyMissions, getTodayStr, MISSIONS_BY_ID } from "@/lib/dailies";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { ok } = rateLimit(`dailies-progress:${user.id}`, 5, 10_000);
  if (!ok) {
    return NextResponse.json({ error: "Too fast" }, { status: 429 });
  }

  const body = await request.json() as { mission_id?: string; github_login?: string };
  const { mission_id, github_login: githubLogin } = body;

  if (!mission_id || !MISSIONS_BY_ID.has(mission_id)) {
    return NextResponse.json({ error: "Invalid mission_id" }, { status: 400 });
  }
  if (!githubLogin || typeof githubLogin !== "string") {
    return NextResponse.json({ error: "github_login is required in body" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const dev = await getDeveloperOwnedByUser<{ id: number; claimed: boolean }>(admin, user.id, githubLogin, "id, claimed");
  if (!dev || !dev.claimed) {
    return NextResponse.json({ error: "Developer not found or not yours" }, { status: 403 });
  }

  const today = getTodayStr();
  const missions = getDailyMissions(dev.id, today);
  const mission = missions.find((m) => m.id === mission_id);

  if (!mission) {
    return NextResponse.json({ error: "Mission not assigned today" }, { status: 400 });
  }

  const { data: result, error: rpcError } = await admin.rpc("record_mission_progress", {
    p_developer_id: dev.id,
    p_mission_id: mission_id,
    p_threshold: mission.threshold,
    p_increment: 1,
  });

  if (rpcError) {
    console.error("[dailies] progress RPC error:", rpcError);
    return NextResponse.json({ error: "Failed to update progress" }, { status: 500 });
  }

  return NextResponse.json(result);
}
