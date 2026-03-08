import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getStoreInfos, parseDashLogin } from "@/lib/dash-api";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const sb = getSupabaseAdmin();

  const { data: rpcData, error: rpcError } = await sb.rpc(
    "get_developer_by_name_authorized",
    { p_name: username }
  );

  let dev = Array.isArray(rpcData) ? rpcData[0] : rpcData;

  if (rpcError) {
    console.error("get_developer_by_name_authorized error:", rpcError);
    return NextResponse.json(
      { error: "Failed to lookup developer" },
      { status: 500 }
    );
  }

  if (!dev) {
    const { data: devFromDb } = await sb.from("developers").select("*").eq("github_login", username).eq("allow_data_for_buildings", true).single();
    dev = devFromDb;
  }
  
  if (!dev) {
    return NextResponse.json(
      { error: "Developer not found" },
      { status: 404 }
    );
  }

  const age = Date.now() - new Date(dev.fetched_at).getTime();
  const useCache = age < CACHE_TTL_MS;

  if (useCache) {
    return NextResponse.json(dev, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  }

  const parsed = parseDashLogin(dev.github_login);
  if (parsed) {
    try {
      const info = await getStoreInfos({
        platform: parsed.platform,
        store_id: parsed.store_id,
        user_id: parsed.user_id,
      });

      if (info) {
        const contributions = Math.round(info.contributions);
        const public_repos = Math.round(info.public_repos);
        const fetched_at = new Date().toISOString();

        await sb
          .from("developers")
          .update({ contributions, public_repos, fetched_at, district: parsed.platform })
          .eq("id", dev.id);

        const { data: updated } = await sb
          .from("developers")
          .select("*")
          .eq("id", dev.id)
          .single();

        if (dev.claimed_by) {
          await sb
            .from("profiles")
            .update({ stores_synced_at: fetched_at })
            .eq("id", dev.claimed_by);
        }

        return NextResponse.json(updated ?? dev, {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          },
        });
      }
    } catch (err) {
      console.error("Dash getStoreInfos error:", err);
    }
  }

  return NextResponse.json(dev, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
