import Link from "next/link";

import { Button } from "@/components/controls";
import { AppShell } from "@/components/shell/app-shell";

// 404 wg NotFound.dc.html. Poza grupą (app), więc powłokę dokładamy sami —
// tylko dla zalogowanego (requireUser=false: gość widzi samą treść).
export default function NotFound() {
  return (
    <AppShell requireUser={false}>
      <header className="flex min-h-[34px] items-center border-b border-[#eaeaea] px-6 py-3">
        <div className="font-mono text-[13px] text-[#666666]">
          <span>rhytm</span> <span className="text-[#b0b0b0]">/</span>{" "}
          <span className="text-[#171717]">404</span>
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="flex max-w-[440px] flex-col items-center gap-3.5 text-center">
          <span className="font-mono text-[64px] font-medium tracking-[-0.04em]">
            404
          </span>
          <h1 className="m-0 text-xl font-semibold">Tej strony nie ma</h1>
          <p className="m-0 leading-normal text-[#666666]">
            Mogła zostać usunięta albo link jest niepełny. Strony usunięte w
            ciągu 30 dni możesz przywrócić z kosza.
          </p>
          <div className="flex gap-2">
            <Button asChild variant="primary" size="sm">
              <Link href="/dzis">Wróć do Dziś</Link>
            </Button>
            {/* Wyszukiwarka ⌘K dojdzie w kolejnych etapach */}
            <Button
              variant="secondary"
              size="sm"
              aria-disabled="true"
              className="cursor-default"
            >
              Szukaj
              <span className="rounded border border-[#e0e0e0] bg-white px-[5px] font-mono text-[11px] font-normal text-[#404040]">
                ⌘K
              </span>
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
