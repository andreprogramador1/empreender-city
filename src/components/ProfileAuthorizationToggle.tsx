"use client";

import { useState, useEffect } from "react";
import type { ProfileResponse } from "@/lib/current-developer";

interface ProfileState extends ProfileResponse {}

export default function ProfileAuthorizationToggle() {
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setProfile(data);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle() {
    if (!profile || updating) return;
    const next = !profile.allow_data_for_buildings;
    setUpdating(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allow_data_for_buildings: next }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <p className="text-[10px] text-muted normal-case">Carregando...</p>
    );
  }

  if (!profile) {
    return null;
  }

  const accent = "#c8e64a";

  return (
    <div className="border-[2px] border-border bg-bg-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-cream">
            Uso dos meus prédios na cidade
          </p>
          <p className="mt-1 text-[10px] text-muted normal-case">
            {profile.allow_data_for_buildings
              ? "Seus prédios estão visíveis na cidade."
              : "Seus prédios não aparecem na cidade até você autorizar."}
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={updating}
          className="btn-press px-4 py-2 text-[10px] text-bg disabled:opacity-50"
          style={{
            backgroundColor: profile.allow_data_for_buildings ? "#666" : accent,
            boxShadow: profile.allow_data_for_buildings
              ? "3px 3px 0 0 #333"
              : "3px 3px 0 0 #5a7a00",
          }}
        >
          {updating
            ? "..."
            : profile.allow_data_for_buildings
              ? "Desautorizar uso"
              : "Autorizar uso"}
        </button>
      </div>
    </div>
  );
}
