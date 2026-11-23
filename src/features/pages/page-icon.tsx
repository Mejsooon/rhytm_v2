import { Table } from "lucide-react";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";

import { IKONY_POLECANE, parsePageIcon } from "./page-icons";

// Ikona strony: `lucide:<nazwa>` → ikona Lucide w kolorze tekstu wokół. Polecane ikony są importowane statycznie
// (od razu, bez migania), pozostałe ładują się dynamicznie. Brak ikony, stary zapis albo śmieci → domyślna tabela;
// do czasu załadowania (i dla nieznanej nazwy) też tabela.
export function PageIcon({ icon, size = 16 }: { icon: string; size?: number }) {
  const nazwa = parsePageIcon(icon);
  const Polecana = nazwa === null ? undefined : IKONY_POLECANE[nazwa];

  return (
    <span
      aria-hidden="true"
      data-page-icon={nazwa ?? "table"}
      className="inline-flex flex-none items-center justify-center"
      style={{ width: size, height: size }}
    >
      {nazwa === null ? (
        <Table size={size} strokeWidth={2} color="currentColor" className="block" />
      ) : Polecana !== undefined ? (
        <Polecana size={size} strokeWidth={2} color="currentColor" className="block" />
      ) : (
        <DynamicIcon
          name={nazwa as IconName}
          size={size}
          strokeWidth={2}
          color="currentColor"
          className="block"
          fallback={() => <Table size={size} strokeWidth={2} color="currentColor" className="block" />}
        />
      )}
    </span>
  );
}
