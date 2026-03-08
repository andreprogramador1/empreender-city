import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getDeveloperOwnedByUser } from "@/lib/api-developer";

const UPDATABLE_FIELDS = [
  "email_enabled",
  "push_enabled",
  "social",
  "digest",
  "marketing",
  "streak_reminders",
  "digest_frequency",
  "quiet_hours_start",
  "quiet_hours_end",
  "channel_overrides",
] as const;

/**
 * GET /api/notification-preferences?github_login=...
 * Returns the authenticated user's notification preferences for that developer.
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
  const dev = await getDeveloperOwnedByUser<{ id: number }>(sb, user.id, githubLogin, "id");
  if (!dev) {
    return NextResponse.json({ error: "Developer not found or not yours" }, { status: 403 });
  }

  const { data: prefs } = await sb
    .from("notification_preferences")
    .select("*")
    .eq("developer_id", dev.id)
    .maybeSingle();

  // Return defaults if no row exists
  if (!prefs) {
    return NextResponse.json({
      email_enabled: true,
      push_enabled: true,
      transactional: true,
      social: true,
      digest: true,
      marketing: false,
      streak_reminders: true,
      digest_frequency: "realtime",
      quiet_hours_start: null,
      quiet_hours_end: null,
      channel_overrides: {},
    });
  }

  return NextResponse.json(prefs);
}

/**
 * PATCH /api/notification-preferences
 * Update authenticated user's notification preferences.
 * `transactional` cannot be disabled (purchase receipts always send).
 */
export async function PATCH(request: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json() as Record<string, unknown> & { github_login?: string };
  const githubLogin = body.github_login;
  if (!githubLogin || typeof githubLogin !== "string") {
    return NextResponse.json({ error: "github_login is required in body" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const dev = await getDeveloperOwnedByUser<{ id: number }>(sb, user.id, githubLogin, "id");
  if (!dev) {
    return NextResponse.json({ error: "Developer not found or not yours" }, { status: 403 });
  }

  // Filter to only allowed fields
  const update: Record<string, unknown> = {};
  for (const field of UPDATABLE_FIELDS) {
    if (field in body) {
      update[field] = body[field];
    }
  }

  // Prevent disabling transactional
  if ("transactional" in update) {
    delete update.transactional;
  }

  // Validate digest_frequency
  if (update.digest_frequency && !["realtime", "hourly", "daily", "weekly"].includes(update.digest_frequency as string)) {
    return NextResponse.json({ error: "Invalid digest_frequency" }, { status: 400 });
  }

  // Validate quiet hours
  if (update.quiet_hours_start !== undefined) {
    const h = update.quiet_hours_start as number | null;
    if (h !== null && (h < 0 || h > 23)) {
      return NextResponse.json({ error: "quiet_hours_start must be 0-23" }, { status: 400 });
    }
  }
  if (update.quiet_hours_end !== undefined) {
    const h = update.quiet_hours_end as number | null;
    if (h !== null && (h < 0 || h > 23)) {
      return NextResponse.json({ error: "quiet_hours_end must be 0-23" }, { status: 400 });
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  update.updated_at = new Date().toISOString();

  const { data: updated, error } = await sb
    .from("notification_preferences")
    .upsert(
      { developer_id: dev.id, ...update },
      { onConflict: "developer_id" },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(updated);
}
