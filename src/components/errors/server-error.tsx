"use client";

// Ekran 500 wg S2ServerError. Kod = error.digest, ten sam co w logach Vercel.
import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/controls";
import { FeedbackDialog } from "@/features/help/feedback-dialog";

export function ServerError({ error, retry }: { error: unknown; retry: () => void }) {
  const [zgloszenie, setZgloszenie] = React.useState(false);
  const kod = (error as { digest?: string } | null)?.digest;

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="box-content flex min-h-9 items-center border-b border-border px-6 py-2.5">
        <nav aria-label="Okruszki" className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>rhytm</span>
          <span aria-hidden="true">/</span>
          <b aria-current="page" className="font-medium text-foreground">
            Błąd
          </b>
        </nav>
      </header>
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="flex max-w-[440px] flex-col items-center gap-2 px-6 py-8 text-center">
          <span className="text-[64px] leading-none font-semibold tracking-[-0.04em] text-foreground tabular-nums">
            500
          </span>
          <h1 className="m-0 mt-2 text-[22px] font-semibold tracking-[-0.015em]">
            Coś poszło nie tak po naszej stronie
          </h1>
          <p className="m-0 leading-normal text-muted-foreground">
            Twoje dane są bezpieczne. Spróbuj odświeżyć za chwilę — jeśli błąd wraca, zgłoś go, a dołączymy kod błędu.
          </p>
          {kod && (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
              kod: {kod}
            </span>
          )}
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button variant="primary" onClick={retry}>
              Odśwież
            </Button>
            <Button onClick={() => setZgloszenie(true)}>Zgłoś błąd</Button>
            <Button asChild variant="ghost">
              <Link href="/dzis">Wróć do Dziś</Link>
            </Button>
          </div>
        </div>
      </div>
      {zgloszenie && <FeedbackDialog kind="bug" code={kod} onClose={() => setZgloszenie(false)} />}
    </div>
  );
}
