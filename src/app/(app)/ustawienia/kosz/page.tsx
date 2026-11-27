import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { ModuleHeader } from "@/components/shell/module-header";
import { loadTrash } from "@/features/pages/actions";
import { TrashList } from "@/features/settings/trash-list";
import { safeTimezone } from "@/lib/time/timezones";
import { createClient } from "@/lib/supabase/server";

// Kosz (S2Trash): usunięte strony i wiersze z ostatnich 30 dni
async function Kosz() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const { data: profil } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("user_id", user.id)
    .maybeSingle();
  const kosz = await loadTrash();
  return (
    <TrashList
      pages={kosz.ok ? kosz.pages : []}
      rows={kosz.ok ? kosz.rows : []}
      timeZone={safeTimezone(profil?.timezone)}
      loadError={!kosz.ok}
    />
  );
}

export default function KoszPage() {
  return (
    <>
      <ModuleHeader
        title="Kosz"
        webParent="Ustawienia"
        phoneBack={{ href: "/ustawienia", label: "Wstecz" }}
        phoneCenterTitle
      />
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-3 px-6 py-7 max-[799px]:px-4 max-[799px]:pt-4">
        <div>
          <h2 className="m-0 text-2xl font-semibold tracking-[-0.02em] max-[799px]:hidden">Kosz</h2>
          <p className="m-0 mt-1 text-muted-foreground">
            Usunięte strony i wiersze tabel zostają tu 30 dni. Potem znikają na stałe.
          </p>
        </div>
        <Suspense fallback={null}>
          <Kosz />
        </Suspense>
        <p className="m-0 text-xs text-muted-foreground">
          Do kosza wchodzisz z Ustawienia → Ogólne albo z linku na stronie 404. Przywrócona strona wraca na koniec
          listy w pasku bocznym.
        </p>
      </div>
    </>
  );
}
