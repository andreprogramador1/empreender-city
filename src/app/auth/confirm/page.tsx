"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { createBrowserSupabase } from "@/lib/supabase";

function parseHashParams(hash: string): Record<string, string> {
  const params: Record<string, string> = {};
  if (!hash || hash.startsWith("#")) hash = hash.slice(1);
  hash.split("&").forEach((pair) => {
    const [k, v] = pair.split("=").map((s) => decodeURIComponent(s || ""));
    if (k && v) params[k] = v;
  });
  return params;
}

/**
 * Página de confirmação após o magic link (login via Dash).
 * O Supabase redireciona para esta URL com #access_token=... e #refresh_token=... no hash.
 * Extraímos os tokens, chamamos setSession para persistir nos cookies (path=/),
 * e só então redirecionamos para o servidor enxergar a sessão.
 */
export default function AuthConfirmPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const next = searchParams.get("next") ?? "/";
    const targetPath = next.startsWith("/") ? next : `/${next}`;

    const supabase = createBrowserSupabase();

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let runTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let redirecting = false;

    function clearAllTimers() {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (runTimeoutId) {
        clearTimeout(runTimeoutId);
        runTimeoutId = null;
      }
    }

    function redirectToTarget() {
      if (redirecting) return;
      redirecting = true;
      clearAllTimers();
      setStatus("ok");
      window.location.replace(targetPath);
    }

    function failWithError(message: string, detail?: unknown) {
      clearAllTimers();
      setStatus("error");
      setErrorMessage(message);
      console.error("[auth/confirm] Login falhou:", message, detail ?? "");
    }

    const run = async () => {
      if (cancelled) return;
      const params = typeof window !== "undefined" ? parseHashParams(window.location.hash) : {};
      const access_token = params.access_token;
      const refresh_token = params.refresh_token;

      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (cancelled) return;
        if (error) {
          failWithError(error.message, error);
          return;
        }
        await new Promise((r) => setTimeout(r, 100));
        if (cancelled) return;
        redirectToTarget();
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) {
        await new Promise((r) => setTimeout(r, 100));
        if (cancelled) return;
        redirectToTarget();
        return;
      }
      if (runTimeoutId) clearTimeout(runTimeoutId);
      runTimeoutId = setTimeout(run, 200);
    };

    timeoutId = setTimeout(() => {
      timeoutId = null;
      setStatus("error");
      const msg = "Tempo esgotado sem receber sessão (hash sem access_token/refresh_token ou detecção automática não concluiu).";
      setErrorMessage(msg);
      console.error("[auth/confirm]", msg, "Hash presente:", typeof window !== "undefined" ? !!window.location.hash : false);
    }, 10000);

    run();

    const sub = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      if (session) {
        clearAllTimers();
        redirectToTarget();
      }
    });

    return () => {
      cancelled = true;
      clearAllTimers();
      sub.data.subscription.unsubscribe();
    };
  }, [searchParams]);

  if (status === "error") {
    return (
      <div style={{ padding: "2rem", textAlign: "center", maxWidth: "32rem", margin: "0 auto" }}>
        <p style={{ fontWeight: 600 }}>Não foi possível concluir o login.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <p>Entrando...</p>
    </div>
  );
}
