"use client";

// Treść ekranu „Konto czeka na usunięcie” (/konto-usuniete, decyzja C3): data trwałego usunięcia,
// „Przywróć konto”, pobranie danych (decyzja C18) i „Wyloguj”. Ramkę konta (AuthShell) dokłada strona.
import { Clock } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/controls/button";
import { signOut } from "@/features/auth/actions";
import { restoreAccount } from "./account-actions";

const DZIEN_MS = 24 * 60 * 60 * 1000;

export function RestoreAccount({
  email,
  requestedAt,
  timeZone,
}: {
  email: string;
  requestedAt: string;
  timeZone: string;
}) {
  const [blad, setBlad] = useState<string | null>(null);
  const [trwa, startTransition] = useTransition();

  // Trwałe usunięcie = prośba + 30 dni, po polsku w strefie z profilu („24 grudnia 2026”)
  const prosba = new Date(requestedAt).getTime();
  const dataUsuniecia = Number.isNaN(prosba)
    ? null
    : new Intl.DateTimeFormat("pl-PL", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone,
      }).format(new Date(prosba + 30 * DZIEN_MS));

  function przywroc() {
    setBlad(null);
    startTransition(async () => {
      try {
        // Sukces kończy się przekierowaniem na /dzis
        const wynik = await restoreAccount();
        if (wynik && !wynik.ok) setBlad(wynik.message);
      } catch (e) {
        unstable_rethrow(e);
        setBlad("Nie udało się przywrócić konta. Spróbuj ponownie.");
      }
    });
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center max-[799px]:mt-6">
      <span className="flex size-10 items-center justify-center rounded-[10px] border border-destructive-border bg-destructive-soft text-destructive-foreground shadow-xs">
        <Clock aria-hidden="true" className="size-5" strokeWidth={2} />
      </span>
      <h1 className="m-0 text-xl font-semibold">Konto czeka na usunięcie</h1>
      <p className="m-0 leading-normal text-muted-foreground">
        Konto <span className="font-medium text-foreground">{email}</span>{" "}
        zostanie trwale usunięte
        {dataUsuniecia ? (
          <>
            {" "}
            <span className="font-medium text-foreground">{dataUsuniecia}</span>
          </>
        ) : null}{" "}
        (30 dni od prośby o usunięcie). Do tego czasu możesz je przywrócić.
      </p>
      {blad && (
        <p role="alert" className="m-0 text-[13px] text-destructive-foreground">
          {blad}
        </p>
      )}
      <div className="flex w-full flex-col gap-2">
        <Button
          size="lg"
          aria-disabled={trwa}
          onClick={() => {
            if (!trwa) przywroc();
          }}
          className="w-full leading-[1.21] max-[799px]:text-[15px]"
        >
          Przywróć konto
        </Button>
        <Button
          asChild
          variant="secondary"
          size="lg"
          className="w-full leading-[1.21] max-[799px]:text-[15px]"
        >
          {/* Trasa API, nie strona — zwykły link z pobraniem pliku */}
          <a href="/api/eksport" download>
            Pobierz dane (.json)
          </a>
        </Button>
        <form action={signOut} className="w-full">
          <Button
            type="submit"
            variant="ghost"
            size="lg"
            className="w-full leading-[1.21] max-[799px]:text-[15px]"
          >
            Wyloguj
          </Button>
        </form>
      </div>
    </div>
  );
}
