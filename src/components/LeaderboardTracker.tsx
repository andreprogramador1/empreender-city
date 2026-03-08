"use client";

import { useEffect } from "react";
import { trackLeaderboardViewed } from "@/lib/himetrica";
import { useCurrentDeveloper } from "@/components/CurrentDeveloperProvider";
import { withDeveloper } from "@/lib/current-developer";

export default function LeaderboardTracker({ tab }: { tab: string }) {
  const { currentDeveloper } = useCurrentDeveloper() ?? {};

  useEffect(() => {
    trackLeaderboardViewed(tab);
    if (currentDeveloper?.github_login) {
      fetch("/api/dailies/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withDeveloper({ mission_id: "check_leaderboard" }, currentDeveloper.github_login)),
      }).catch(() => {});
    }
  }, [tab, currentDeveloper?.github_login]);
  return null;
}
