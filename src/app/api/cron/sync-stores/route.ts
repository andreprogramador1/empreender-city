import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { buildDashLogin, getUserStores, getStoreInfos } from "@/lib/dash-api";

const PROFILES_LIMIT = 200;

/**
 * GET /api/cron/sync-stores
 * Sincroniza lojas dos usuários: busca profiles (ordenados por stores_synced_at asc,
 * allow_data_for_buildings = true), chama getUserStores para cada um, atualiza/insere
 * developers e marca allow_data_for_buildings = false nos que deixaram de existir.
 * Auth: Bearer CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const sb = getSupabaseAdmin();

  const { data: profiles, error: profilesError } = await sb
    .from("profiles")
    .select("id, dash_user_id")
    .eq("allow_data_for_buildings", true)
    .order("stores_synced_at", { ascending: true, nullFirst: true })
    .limit(PROFILES_LIMIT);

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const list = profiles ?? [];
  let processed = 0;
  let errors = 0;

  for (const profile of list) {
    const dashUserId = profile.dash_user_id;
    if (dashUserId == null) continue;

    try {
      const stores = await getUserStores({
        dashUserId: Number(dashUserId),
        supabaseUser: { id: profile.id },
      });

      const now = new Date().toISOString();
      const updatedLogins: string[] = [];

      for (const store of stores) {
        const githubLogin = buildDashLogin(store.platform, store.store_id, store.user_id);
        const { data: existingDev } = await sb
          .from("developers")
          .select("id")
          .eq("github_login", githubLogin)
          .eq("claimed_by", profile.id)
          .maybeSingle();

        if (!existingDev) {
          const { data: inserted } = await sb
            .from("developers")
            .insert({
              github_login: githubLogin,
              name: store.store_name,
              store_domain: store.store_domain ?? "",
              contributions: 0,
              public_repos: 0,
              claimed: true,
              claimed_by: profile.id,
              allow_data_for_buildings: true,
              fetched_at: now,
              district: store.platform,
            })
            .select("id")
            .single();

          if (inserted) {
            updatedLogins.push(githubLogin);
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
          updatedLogins.push(githubLogin);
          try {
            const columnsToUpdate: Record<string, unknown> = { allow_data_for_buildings: true };
            if (store.store_domain) {
              columnsToUpdate.store_domain = store.store_domain;
            }
            await sb
              .from("developers")
              .update(columnsToUpdate)
              .eq("id", existingDev.id);
          } catch {
            // column may not exist yet before migration 037
          }

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
              .eq("id", existingDev.id);
          }
        }
      }

      // Marcar developers do usuário que não estão mais na lista de lojas como allow_data_for_buildings = false
      const updatedSet = new Set(updatedLogins);
      const { data: ownedDevs } = await sb
        .from("developers")
        .select("id, github_login")
        .eq("claimed_by", profile.id)
        .eq("allow_data_for_buildings", true);

      const idsToDisable = (ownedDevs ?? [])
        .filter((d) => !updatedSet.has(d.github_login))
        .map((d) => d.id);
      if (idsToDisable.length > 0) {
        await sb.from("developers").update({ allow_data_for_buildings: false }).in("id", idsToDisable);
      }

      await sb
        .from("profiles")
        .update({ stores_synced_at: now })
        .eq("id", profile.id);

      processed++;
    } catch (err) {
      console.error("sync-stores: profile", profile.id, err);
      errors++;
    }
  }

  return NextResponse.json({
    ok: true,
    processed,
    errors,
    profiles_considered: list.length,
    duration_ms: Date.now() - started,
  });
}
