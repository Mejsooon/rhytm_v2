import { ModuleHeader } from "@/components/shell/module-header";
import { SearchView } from "@/features/search/search-view";

// Szukaj (CMSearch): web ma nagłówek modułu, telefon własny nagłówek z polem i „Anuluj” w SearchView.
// Strona nie czyta danych sesji — wyszukiwanie to akcja serwerowa wołana z klienta.
export default function SzukajPage() {
  return (
    <>
      <ModuleHeader title="Szukaj" webOnly />
      <SearchView />
    </>
  );
}
