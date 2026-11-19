import type { LoadedBlock } from "../load-page";

// Tymczasowy widok bloku tabeli — Task 7 zastępuje go prawdziwą tabelą
export function TableBlockPlaceholder({ block }: { block: LoadedBlock }) {
  const nazwa = typeof block.content.name === "string" ? block.content.name.trim() : "";
  return (
    <div className="my-1.5 text-[15px] font-semibold text-[#171717]">
      {nazwa === "" ? "Tabela bez nazwy" : nazwa}
    </div>
  );
}
