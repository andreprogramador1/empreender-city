import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { buildDashLogin, getUserStores, getStoreInfos } from "@/lib/dash-api";

/**
 * GET /api/profile
 * Returns the authenticated user's profile and the list of developers (lojas) they own.
 * Frontend should use `developers` to show a store selector and send the chosen
 * developer's github_login in API calls that act on behalf of a store.
 */
export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const { data: profile } = await sb
    .from("profiles")
    .select("allow_data_for_buildings, stores_synced_at, dash_user_id")
    .eq("id", user.id)
    .maybeSingle();

  const { data: developers } = await sb
    .from("developers")
    .select("id, github_login, name, avatar_url, store_domain, claimed")
    .eq("claimed_by", user.id)
    .eq("allow_data_for_buildings", true)
    .order("claimed_at", { ascending: true });

  const base = {
    allow_data_for_buildings: profile?.allow_data_for_buildings ?? false,
    stores_synced_at: profile?.stores_synced_at ?? null,
    dash_user_id: profile?.dash_user_id ?? null,
  };

  return NextResponse.json({
    ...base,
    developers: (developers ?? []).map((d) => ({
      id: d.id,
      github_login: d.github_login,
      name: d.name,
      avatar_url: d.avatar_url,
      store_domain: d.store_domain ?? null,
    })),
  });
}

/**
 * PATCH /api/profile
 * Body: { allow_data_for_buildings: boolean }
 * On desautorizar: sets flag, triggers city-snapshot cron.
 * On autorizar: if user has no stores, syncs from Dash (getUserStores → getStoreInfos).
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { allow_data_for_buildings?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const allowData = body.allow_data_for_buildings;
  if (typeof allowData !== "boolean") {
    return NextResponse.json(
      { error: "allow_data_for_buildings must be a boolean" },
      { status: 400 }
    );
  }

  const sb = getSupabaseAdmin();

  const { data: existing } = await sb
    .from("profiles")
    .select("allow_data_for_buildings, dash_user_id")
    .eq("id", user.id)
    .maybeSingle();

  const wasAllowed = existing?.allow_data_for_buildings ?? false;

  const { error: updateError } = await sb
    .from("profiles")
    .update({ allow_data_for_buildings: allowData })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (!allowData) {
    try {
      await sb
        .from("developers")
        .update({ allow_data_for_buildings: false })
        .eq("claimed_by", user.id);
    } catch {
      // column may not exist yet before migration 037
    }
  }

  if (!wasAllowed && allowData) {
    const dashUserId = existing?.dash_user_id ?? user.user_metadata?.dash_user_id;
    if (dashUserId != null) {
      try {
        const stores = await getUserStores({
          dashUserId: Number(dashUserId),
          supabaseUser: { id: user.id, email: user.email ?? undefined },
        });
        const now = new Date().toISOString();

        for (const store of stores) {
          const githubLogin = buildDashLogin(store.platform, store.store_id, store.user_id);
          const { data: existingDev } = await sb
            .from("developers")
            .select("id")
            .eq("github_login", githubLogin)
            .eq("claimed_by", user.id)
            .maybeSingle();

          if (!existingDev) {
            const { data: inserted } = await sb
              .from("developers")
              .insert({
                github_login: githubLogin,
                name: store.store_name,
                contributions: 0,
                public_repos: 0,
                claimed: true,
                claimed_by: user.id,
                allow_data_for_buildings: true,
                fetched_at: now,
                district: store.platform,
              })
              .select("id")
              .single();

            if (inserted) {
              const info = await getStoreInfos({
                platform: store.platform,
                store_id: store.store_id,
                user_id: store.user_id,
              });
        
              if (info) {
                await sb
                  .from("developers")
                  .update({
                    contributions: Math.round(info.contributions),
                    public_repos: Math.round(info.public_repos),
                    fetched_at: now,
                  })
                  .eq("id", inserted.id);
              }
            }
          } else {
            try {
              await sb
                .from("developers")
                .update({ allow_data_for_buildings: true })
                .eq("id", existingDev.id);
            } catch {
              // column may not exist yet before migration 037
            }
          }
        }

        await sb
          .from("profiles")
          .update({ stores_synced_at: now })
          .eq("id", user.id);
      } catch (err) {
        console.error("Profile PATCH: Dash sync error", err);
      }
    }  
  }

  const { count } = await sb
    .from("developers")
    .select("id", { count: "exact", head: true })
    .eq("claimed_by", user.id);

  if ((count ?? 0) > 0) {
    try {
      await sb
      .from("city_stats")
      .update({ snapshot_refresh_requested_at: new Date().toISOString() })
      .eq("id", 1);

      const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    
      const cronSecret = process.env.CRON_SECRET;
    
      if (cronSecret) {
        // Fire-and-forget: não bloqueia a resposta do profile; snapshot atualiza em background
        void fetch(`${base}/api/cron/city-snapshot`, {
          method: "GET",
          headers: { Authorization: `Bearer ${cronSecret}` },
        }).catch(() => {});
      }
    } catch {
      // column may not exist
    }
  }

  const { data: profile } = await sb
    .from("profiles")
    .select("allow_data_for_buildings, stores_synced_at, dash_user_id")
    .eq("id", user.id)
    .single();

  return NextResponse.json(profile ?? { allow_data_for_buildings: allowData, stores_synced_at: null, dash_user_id: null });
}
