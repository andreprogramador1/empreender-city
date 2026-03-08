import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getDeveloperOwnedByUser } from "@/lib/api-developer";
import { RAID_VEHICLE_ITEMS, RAID_TAG_ITEMS } from "@/lib/zones";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const devId = searchParams.get("developer_id");
  const githubLogin = searchParams.get("github_login");

  const admin = getSupabaseAdmin();
  let developerId: number | null = null;

  if (devId) {
    developerId = parseInt(devId, 10);
  } else if (githubLogin) {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const dev = await getDeveloperOwnedByUser<{ id: number }>(admin, user.id, githubLogin, "id");
    if (dev) developerId = dev.id;
  }

  if (!developerId) {
    return NextResponse.json({ vehicle: "airplane", tag: "default" });
  }

  const { data } = await admin
    .from("developer_customizations")
    .select("config")
    .eq("developer_id", developerId)
    .eq("item_id", "raid_loadout")
    .maybeSingle();

  const config = (data?.config as { vehicle?: string; tag?: string }) ?? {};

  return NextResponse.json({
    vehicle: config.vehicle ?? "airplane",
    tag: config.tag ?? "default",
  });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { github_login?: string; vehicle?: string; tag?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const githubLogin = body.github_login;
  if (!githubLogin || typeof githubLogin !== "string") {
    return NextResponse.json({ error: "github_login is required in body" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const dev = await getDeveloperOwnedByUser<{ id: number }>(admin, user.id, githubLogin, "id");
  if (!dev) {
    return NextResponse.json({ error: "Developer not found or not yours" }, { status: 403 });
  }

  const { vehicle, tag } = body;

  // Fetch owned items for validation
  const { data: purchases } = await admin
    .from("purchases")
    .select("item_id, items!inner(metadata)")
    .eq("developer_id", dev.id)
    .eq("status", "completed");

  const ownedSet = new Set((purchases ?? []).map((p) => p.item_id));

  // Build config from current + updates
  const { data: currentData } = await admin
    .from("developer_customizations")
    .select("config")
    .eq("developer_id", dev.id)
    .eq("item_id", "raid_loadout")
    .maybeSingle();

  const current = (currentData?.config as { vehicle?: string; tag?: string }) ?? {};
  const config: { vehicle: string; tag: string } = {
    vehicle: current.vehicle ?? "airplane",
    tag: current.tag ?? "default",
  };

  // Validate vehicle
  if (vehicle !== undefined) {
    if (vehicle === "airplane") {
      config.vehicle = "airplane";
    } else if (RAID_VEHICLE_ITEMS.includes(vehicle) && ownedSet.has(vehicle)) {
      config.vehicle = vehicle;
    } else {
      return NextResponse.json({ error: "Vehicle not owned or invalid" }, { status: 403 });
    }
  }

  // Validate tag
  if (tag !== undefined) {
    if (tag === "default") {
      config.tag = "default";
    } else if (RAID_TAG_ITEMS.includes(tag) && ownedSet.has(tag)) {
      config.tag = tag;
    } else {
      return NextResponse.json({ error: "Tag not owned or invalid" }, { status: 403 });
    }
  }

  // Upsert
  await admin.from("developer_customizations").upsert(
    {
      developer_id: dev.id,
      item_id: "raid_loadout",
      config,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "developer_id,item_id" }
  );

  return NextResponse.json({ ok: true, vehicle: config.vehicle, tag: config.tag });
}
