import * as React from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { loadPages } from "@/features/pages/load-pages";
import { getAvatarUrl } from "@/features/profile/avatar-url";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "./app-sidebar";
import { TabBar } from "./tab-bar";

// Czyta użytkownika i profil, a potem układa sidebar + <main> + dolny pasek.
// Dane zależą od ciasteczek, więc (cacheComponents) komponent musi stać w Suspense.
async function Powloka({
  children,
  requireUser,
}: {
  children: React.ReactNode;
  requireUser: boolean;
}) {
  // Odczyt sesji Supabase używa Date.now() — czekamy na żądanie, żeby Next nie traktował go jako prerenderu
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Panel aplikacji bez sesji → logowanie; 404 pokazujemy też gościowi, ale bez powłoki
    if (requireUser) redirect("/logowanie");
    return <main className="flex min-w-0 flex-1 flex-col">{children}</main>;
  }

  const { data: profil } = await supabase
    .from("profiles")
    .select("display_name, avatar_path")
    .eq("user_id", user.id)
    .maybeSingle();

  const email = user.email ?? "";
  const displayName =
    profil?.display_name?.trim() || email.split("@")[0] || "Konto";

  const avatarUrl = await getAvatarUrl(supabase, profil?.avatar_path);
  // Lista stron do sidebara (przy okazji zakłada strony z onboardingu)
  const strony = await loadPages();

  return (
    <>
      <AppSidebar
        user={{ displayName, email, avatarUrl }}
        pages={strony.map((s) => ({
          id: s.id,
          title: s.title || "Bez tytułu",
          icon: s.icon,
        }))}
      />
      {/* Telefon: odstęp na dolny pasek i boczne wcięcia ekranu (notch w poziomie) */}
      <main className="flex min-w-0 flex-1 flex-col pb-(--tabbar-h) max-[799px]:pr-[env(safe-area-inset-right)] max-[799px]:pl-[env(safe-area-inset-left)] min-[800px]:pb-0">
        {children}
      </main>
      <TabBar />
    </>
  );
}

export function AppShell({
  children,
  requireUser = true,
}: {
  children: React.ReactNode;
  requireUser?: boolean;
}) {
  return (
    <div className="flex min-h-dvh flex-1 bg-white text-[#171717]">
      <React.Suspense
        fallback={
          // Szkielet sidebara (web), żeby układ nie skakał podczas ładowania
          <div className="hidden w-[232px] flex-none border-r border-[#eaeaea] bg-[#fafafa] min-[800px]:block" />
        }
      >
        <Powloka requireUser={requireUser}>{children}</Powloka>
      </React.Suspense>
    </div>
  );
}
