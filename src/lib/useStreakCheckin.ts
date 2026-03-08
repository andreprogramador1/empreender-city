"use client";

import { useState, useEffect, useRef } from "react";
import type { Session } from "@supabase/supabase-js";
import { useCurrentDeveloper } from "@/components/CurrentDeveloperProvider";
import { withDeveloper } from "@/lib/current-developer";

export interface RaidSinceLast {
  attacker_login: string;
  success: boolean;
  created_at: string;
}

export interface StreakReward {
  milestone: number;
  item_id: string;
  item_name: string;
}

export interface XpGrantResult {
  granted: number;
  new_total: number;
  new_level: number;
}

export interface StreakData {
  checked_in: boolean;
  already_today: boolean;
  streak: number;
  longest: number;
  was_frozen: boolean;
  new_achievements: string[];
  unseen_count: number;
  kudos_since_last: number;
  raids_since_last?: RaidSinceLast[];
  streak_reward?: StreakReward | null;
  xp?: XpGrantResult | null;
}

const CACHE_KEY = "gc_checkin";

export function useStreakCheckin(
  session: Session | null,
  hasClaimed: boolean,
) {
  const [streakData, setStreakData] = useState<StreakData | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached) as StreakData;
        data.checked_in = false; // no pulse on cached load
        return data;
      }
    } catch {}
    return null;
  });
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  const { currentDeveloper } = useCurrentDeveloper() ?? {};

  useEffect(() => {
    if (!session || !hasClaimed || !currentDeveloper?.github_login) return;
    if (fetchedRef.current) return;
    if (typeof window !== "undefined" && sessionStorage.getItem(CACHE_KEY)) return;

    fetchedRef.current = true;
    setLoading(true);
    const body = withDeveloper({}, currentDeveloper.github_login);

    fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: StreakData | null) => {
        if (data) {
          setStreakData(data);
          if (typeof window !== "undefined") {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
          }
          if (data.unseen_count > 0) {
            fetch("/api/achievements/mark-seen", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }).catch(() => {});
          }
        }
      })
      .catch(() => {
        fetchedRef.current = false;
      })
      .finally(() => setLoading(false));
  }, [session, hasClaimed, currentDeveloper?.github_login]);

  return { streakData, loading };
}
