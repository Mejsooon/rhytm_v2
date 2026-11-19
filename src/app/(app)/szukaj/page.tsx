import { EmptyModule, ModuleHeader } from "@/components/shell/module-header";

// Wyszukiwanie (ikona lupy na Dziś na telefonie) — zaślepka do Etapu 10
export default function SzukajPage() {
  return (
    <>
      <ModuleHeader title="Szukaj" />
      <EmptyModule>Wyszukiwanie pojawi się wkrótce.</EmptyModule>
    </>
  );
}
