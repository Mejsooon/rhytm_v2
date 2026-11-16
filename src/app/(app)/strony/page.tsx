import { EmptyModule, ModuleHeader } from "@/components/shell/module-header";

// Bez przekierowania: serwer nie zna szerokości ekranu. Web pokazuje nagłówek „Moduły / Strony”
// (lista stron żyje w sidebarze), telefon — duży tytuł z ⚙ → /ustawienia.
export default function StronyPage() {
  return (
    <>
      <ModuleHeader title="Strony" phoneLabel="Twoje tabele i notatki" phoneSettingsLink />
      <EmptyModule>Nie masz jeszcze żadnych stron. Strony powstaną w kolejnych etapach.</EmptyModule>
    </>
  );
}
