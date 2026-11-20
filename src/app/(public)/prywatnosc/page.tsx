import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Polityka prywatności — rhytm" };

// Zaślepka — treść prawna zostanie uzupełniona przed publicznym startem
export default function Page() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[640px] flex-col gap-4 px-6 py-12 text-sm leading-normal text-foreground">
      <h1 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">
        Polityka prywatności
      </h1>
      <p className="m-0 text-muted-foreground">[TREŚĆ DO UZUPEŁNIENIA]</p>
      <Link
        href="/rejestracja"
        className="text-foreground underline hover:text-black"
      >
        Wróć
      </Link>
    </main>
  );
}
