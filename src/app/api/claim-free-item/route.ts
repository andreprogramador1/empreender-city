import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getDeveloperOwnedByUser } from "@/lib/api-developer";
import { FREE_CLAIM_ITEM, grantFreeClaimItem } from "@/lib/items";

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

  const admin = getSupabaseAdmin();
  const dev = await getDeveloperOwnedByUser<{ id: number }>(admin, user.id, githubLogin, "id");
  if (!dev) {
    return NextResponse.json({ error: "Developer not found or not yours" }, { status: 403 });
  }

  const granted = await grantFreeClaimItem(dev.id);

// grantFreeClaimItem is idempotent: returns false if already owned.
    // Either way the user should see the success state — treat as 200 OK.
    // (Returning 409 previously caused the frontend to silently reset
    // the button without opening the gift modal — issue #11.)

  return NextResponse.json({
    claimed: true,
    item_id: FREE_CLAIM_ITEM,
  });
}
