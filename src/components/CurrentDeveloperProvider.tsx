"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import type { ProfileDeveloper, ProfileResponse } from "@/lib/current-developer";

const STORAGE_KEY = "gc_current_developer";

type CurrentDeveloperContextValue = {
  developers: ProfileDeveloper[];
  currentDeveloper: ProfileDeveloper | null;
  setCurrentDeveloper: (dev: ProfileDeveloper | null) => void;
  loading: boolean;
};

const CurrentDeveloperContext = createContext<CurrentDeveloperContextValue | null>(null);

export function useCurrentDeveloper() {
  const ctx = useContext(CurrentDeveloperContext);
  return ctx;
}

export function CurrentDeveloperProvider({ children }: { children: React.ReactNode }) {
  const [developers, setDevelopers] = useState<ProfileDeveloper[]>([]);
  const [currentDeveloper, setCurrentDeveloperState] = useState<ProfileDeveloper | null>(null);
  const [loading, setLoading] = useState(true);

  const setCurrentDeveloper = useCallback((dev: ProfileDeveloper | null) => {
    setCurrentDeveloperState(dev);
    try {
      if (dev) {
        localStorage.setItem(STORAGE_KEY, dev.github_login);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      // Refetch profile when auth changes
      fetch("/api/profile")
        .then((r) => (r.ok ? r.json() : null))
        .then((data: ProfileResponse | null) => {
          if (!data?.developers?.length) {
            setDevelopers([]);
            setCurrentDeveloperState(null);
            return;
          }
          setDevelopers(data.developers);
          const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
          const matched = saved
            ? data.developers.find((d) => d.github_login === saved)
            : null;
          if (matched) {
            setCurrentDeveloperState(matched);
          } else if (data.developers.length === 1) {
            setCurrentDeveloperState(data.developers[0]);
            try {
              localStorage.setItem(STORAGE_KEY, data.developers[0].github_login);
            } catch {
              /* ignore */
            }
          } else {
            setCurrentDeveloperState(null);
          }
        })
        .catch(() => {
          setDevelopers([]);
          setCurrentDeveloperState(null);
        })
        .finally(() => setLoading(false));
    });

    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ProfileResponse | null) => {
        if (!data?.developers?.length) {
          setDevelopers([]);
          setCurrentDeveloperState(null);
          return;
        }
        setDevelopers(data.developers);
        const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
        const matched = saved
          ? data.developers.find((d) => d.github_login === saved)
          : null;
        if (matched) {
          setCurrentDeveloperState(matched);
        } else if (data.developers.length === 1) {
          setCurrentDeveloperState(data.developers[0]);
          try {
            localStorage.setItem(STORAGE_KEY, data.developers[0].github_login);
          } catch {
            /* ignore */
          }
        } else {
          setCurrentDeveloperState(null);
        }
      })
      .catch(() => {
        setDevelopers([]);
        setCurrentDeveloperState(null);
      })
      .finally(() => setLoading(false));

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo<CurrentDeveloperContextValue>(
    () => ({
      developers,
      currentDeveloper,
      setCurrentDeveloper,
      loading,
    }),
    [developers, currentDeveloper, setCurrentDeveloper, loading]
  );

  return (
    <CurrentDeveloperContext.Provider value={value}>
      {children}
    </CurrentDeveloperContext.Provider>
  );
}
