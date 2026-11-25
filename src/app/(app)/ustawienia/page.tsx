import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { EmptyModule, ModuleHeader } from "@/components/shell/module-header";
import { getAvatarUrl } from "@/features/profile/avatar-url";
import { MSettingsIndex } from "@/features/settings/mobile/m-settings-index";
import { createClient } from "@/lib/supabase/server";

import pakiet from "../../../../package.json";

// Dane profilu zależą od ciasteczek → connection + Suspense
async function IndeksTelefonu() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const { data: profil } = await supabase
    .from("profiles")
    .select("display_name, avatar_path")
    .eq("user_id", user.id)
    .maybeSingle();
  const email = user.email ?? "";
  return (
    <MSettingsIndex
      name={profil?.display_name?.trim() || email}
      email={email}
      avatarUrl={await getAvatarUrl(supabase, profil?.avatar_path)}
      version={pakiet.version}
    />
  );
}

// /ustawienia: na telefonie indeks ustawień (CMSettings). Serwer nie zna szerokości ekranu, więc nie przekierowuje
// do /ustawienia/ogolne jak dawniej. Na webie nikt tu nie trafia — linki webowe (sidebar) prowadzą wprost do
// /ustawienia/ogolne — a gdyby ktoś wszedł, widzi pusty ekran z linkiem do ustawień ogólnych.
export default function UstawieniaPage() {
  return (
    <>
      <div className="flex flex-1 flex-col max-[799px]:hidden">
        <ModuleHeader title="Ustawienia" webOnly />
        <EmptyModule>
          <Link
            href="/ustawienia/ogolne"
            className="text-foreground underline"
          >
            Przejdź do ustawień ogólnych
          </Link>
        </EmptyModule>
      </div>
      <Suspense fallback={null}>
        <IndeksTelefonu />
      </Suspense>
    </>
  );
}
