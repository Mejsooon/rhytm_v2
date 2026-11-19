import { Suspense } from "react";
import { connection } from "next/server";

import { EmptyModule, ModuleHeader } from "@/components/shell/module-header";
import { loadPages } from "@/features/pages/load-pages";
import { MPages } from "@/features/pages/mobile/m-pages";

// Bez przekierowania: serwer nie zna szerokości ekranu (web/telefon rozdziela sam CSS).
// Telefon zawsze pokazuje listę stron (MPages), web — nagłówek i podpowiedź (lista żyje w sidebarze).
async function Strony() {
  await connection();
  const strony = await loadPages();

  return (
    <>
      <div className="max-[799px]:hidden min-[800px]:contents">
        <ModuleHeader title="Strony" />
        <EmptyModule>
          {strony.length === 0
            ? "Nie masz jeszcze żadnych stron. Dodaj pierwszą przyciskiem „Nowa strona” w panelu po lewej."
            : "Wybierz stronę z listy po lewej."}
        </EmptyModule>
      </div>
      <MPages pages={strony} />
    </>
  );
}

export default function StronyPage() {
  return (
    <Suspense fallback={<ModuleHeader title="Strony" phoneLabel="Twoje tabele i notatki" phoneSettingsLink />}>
      <Strony />
    </Suspense>
  );
}
