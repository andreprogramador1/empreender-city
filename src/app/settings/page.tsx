import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase-server";
import ProfileAuthorizationToggle from "@/components/ProfileAuthorizationToggle";

export const metadata = {
  title: "Configurações - Git City",
  description: "Configurações da sua conta no Git City",
};

const ACCENT = "#c8e64a";

export default async function SettingsPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/?error=not_authenticated");
  }

  return (
    <main className="min-h-screen bg-bg font-pixel uppercase text-warm">
      <div className="mx-auto max-w-lg px-3 py-6 sm:px-4 sm:py-10">
        <Link
          href="/"
          className="mb-6 inline-block text-sm text-muted transition-colors hover:text-cream sm:mb-8"
        >
          &larr; Voltar à cidade
        </Link>

        <div className="border-[3px] border-border bg-bg-raised p-6 sm:p-10">
          <h1 className="text-center text-xl text-cream sm:text-2xl">
            Configurações
          </h1>

          <section className="mt-6">
            <h2 className="mb-3 text-xs" style={{ color: ACCENT }}>
              Dados na cidade
            </h2>
            <ProfileAuthorizationToggle />
          </section>
        </div>
      </div>
    </main>
  );
}
