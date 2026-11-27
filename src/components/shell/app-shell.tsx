import * as React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { loadPages } from "@/features/pages/load-pages";
import { getAvatarUrl } from "@/features/profile/avatar-url";
import { CommandMenu } from "@/features/search/command-menu";
import { VaultProvider } from "@/features/vault/vault-provider";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "./app-sidebar";
import { SidebarStateProvider } from "./sidebar-state";
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

  const { data: zDataUsuniecia, error: bladProfilu } = await supabase
    .from("profiles")
    .select("display_name, avatar_path, deletion_requested_at")
    .eq("user_id", user.id)
    .maybeSingle();
  let profil: { display_name: string | null; avatar_path: string | null } | null =
    zDataUsuniecia;
  if (bladProfilu?.code === "42703") {
    // Stara baza bez kolumny deletion_requested_at: profil bez niej
    const { data: stary } = await supabase
      .from("profiles")
      .select("display_name, avatar_path")
      .eq("user_id", user.id)
      .maybeSingle();
    profil = stary;
  }
  // Konto oznaczone do usunięcia nie wchodzi do aplikacji. Proxy tego pilnuje przy zwykłych żądaniach,
  // ale przekierowanie z Server Action (np. po logowaniu albo nowym haśle) renderuje stronę z pominięciem proxy
  if (zDataUsuniecia?.deletion_requested_at) redirect("/konto-usuniete");

  const email = user.email ?? "";
  const displayName =
    profil?.display_name?.trim() || email.split("@")[0] || "Konto";

  const avatarUrl = await getAvatarUrl(supabase, profil?.avatar_path);
  // Lista stron do sidebara (przy okazji zakłada strony z onboardingu)
  const strony = await loadPages();
  // Stan paska bocznego z ciasteczka — czytany na serwerze, żeby schowany pasek nie mignął po odświeżeniu
  const schowany = (await cookies()).get("rhytm_sidebar")?.value === "collapsed";

  return (
    <VaultProvider>
      <SidebarStateProvider initialCollapsed={schowany}>
        <AppSidebar
          user={{ displayName, email, avatarUrl }}
          pages={strony}
        />
        {/* Telefon: odstęp na dolny pasek i boczne wcięcia ekranu (notch w poziomie) */}
        <main className="flex min-w-0 flex-1 flex-col pb-(--tabbar-h) max-[799px]:pr-[env(safe-area-inset-right)] max-[799px]:pl-[env(safe-area-inset-left)] min-[800px]:pb-0">
          {children}
        </main>
        <TabBar />
        <CommandMenu />
      </SidebarStateProvider>
    </VaultProvider>
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
    <div className="flex min-h-dvh flex-1 bg-white text-foreground">
      <React.Suspense
        fallback={
          // Szkielet sidebara (web), żeby układ nie skakał podczas ładowania
          // Gdy ciasteczko mówi „schowany” (data-sidebar ustawia skrypt w layoucie), szkielet ma szerokość szyny 56 px
          <div
            data-testid="sidebar-skeleton"
            className="hidden w-[232px] flex-none border-r border-border-soft bg-panel min-[800px]:block [html[data-sidebar=collapsed]_&]:w-14"
          />
        }
      >
        <Powloka requireUser={requireUser}>{children}</Powloka>
      </React.Suspense>
    </div>
  );
}
