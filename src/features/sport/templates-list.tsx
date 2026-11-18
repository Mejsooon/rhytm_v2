"use client";

// Lista szablonów treningów (WorkoutTemplates.dc.html, widok listy): ścieżka „Sport / Szablony treningów”,
// „Nowy szablon”, zielony komunikat po zapisie / usunięciu, karty szablonów i karta „+ Nowy szablon”.
// Jedno drzewo dla webu i telefonu — siatka kart sama zawija się w wąskim oknie.
import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/controls";
import { createGymSession } from "./actions";
import type { TemplatesData } from "./load-sport";
import { formatLastUsed, plPlural } from "./model";

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";
// Dni w meta karty jak chipy edytora (1 = pn … 7 = nd)
const DNI = ["", "Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"];

export function TemplatesList({
  data,
  flash,
}: {
  data: TemplatesData;
  // Tekst zielonego komunikatu z adresu (?komunikat=…&nazwa=…) albo null
  flash: string | null;
}) {
  const router = useRouter();

  // Komunikat jest jednorazowy: czyścimy adres bez ponownego pobrania strony,
  // więc odświeżenie albo powrót do listy już go nie pokaże
  useEffect(() => {
    if (flash) window.history.replaceState(null, "", "/sport/szablony");
  }, [flash]);

  // „Rozpocznij” = wystąpienie szablonu z dziś (akcja idempotentna); blokada chroni przed podwójnym kliknięciem
  const tworzy = useRef(false);
  async function rozpocznij(templateId: string, startTime: string) {
    if (tworzy.current) return;
    tworzy.current = true;
    try {
      const wynik = await createGymSession({
        date: data.today,
        start: startTime.slice(0, 5),
        templateId,
      });
      if (wynik.ok && wynik.id) {
        router.push(`/sport/trening/${wynik.id}`);
      } else {
        toast.error(wynik.ok ? BLAD_ZAPISU : wynik.message);
      }
    } catch {
      toast.error(BLAD_ZAPISU);
    } finally {
      tworzy.current = false;
    }
  }

  return (
    <div className="flex min-w-0 flex-col">
      <header className="flex min-h-[34px] flex-wrap items-center justify-between gap-3 border-b border-[#eaeaea] px-6 py-3 max-[799px]:px-4">
        <div className="font-mono text-[13px] text-[#666666]">
          <Link
            href="/sport"
            className="text-[#666666] no-underline hover:text-[#171717]"
          >
            Sport
          </Link>{" "}
          <span className="text-[#b0b0b0]">/</span>{" "}
          <span className="text-[#171717]">Szablony treningów</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="primary" size="sm">
            <Link href="/sport/szablony/nowy">Nowy szablon</Link>
          </Button>
        </div>
      </header>

      <div className="box-border flex w-full max-w-[1100px] flex-col gap-6 px-6 py-7 max-[799px]:px-4 max-[799px]:py-5">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-[-0.02em]">
            Szablony treningów
          </h1>
          <p className="m-0 mt-1.5 text-[#666666]">
            Gotowa lista ćwiczeń i serii. „Rozpocznij” tworzy trening z
            wypełnionymi ciężarami z ostatniego razu.
          </p>
        </div>

        {flash && (
          <div
            role="status"
            className="rounded-lg border border-[#bbe5cc] bg-[#f0faf4] px-3.5 py-2.5 text-[13px] text-[#15803d]"
          >
            {flash}
          </div>
        )}

        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {data.templates.map((t) => {
            const naglowekId = `szablon-${t.id}`;
            const serie = t.items.reduce((a, i) => a + i.sets_count, 0);
            const dni = [...t.weekdays].sort((a, b) => a - b);
            const meta = `${plPlural(t.items.length, "ćwiczenie", "ćwiczenia", "ćwiczeń")} · ${plPlural(serie, "seria", "serie", "serii")}${dni.length ? ` · ${dni.map((d) => DNI[d]).join(", ")}` : ""}`;
            return (
              <section
                key={t.id}
                aria-labelledby={naglowekId}
                className="flex flex-col gap-2.5 rounded-lg border border-[#eaeaea] bg-white p-4 hover:border-[#d4d4d4]"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span id={naglowekId} className="text-base font-semibold">
                    {t.name}
                  </span>
                  <span className="font-mono text-[11px] text-[#6b6b6b]">
                    {`ostatnio: ${formatLastUsed(t.last_used_at, data.profile.timezone)}`}
                  </span>
                </div>
                <span className="font-mono text-xs text-[#666666]">{meta}</span>
                <p className="m-0 text-[13px] leading-[1.6] text-[#404040]">
                  {t.items.length
                    ? t.items.map((i) => i.exerciseName).join(" · ")
                    : "Brak ćwiczeń"}
                </p>
                <div className="mt-auto flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    className="text-[13px]"
                    onClick={() => void rozpocznij(t.id, t.start_time)}
                  >
                    Rozpocznij
                  </Button>
                  <Button asChild size="sm" className="text-[13px]">
                    <Link href={`/sport/szablony/${t.id}`}>Edytuj</Link>
                  </Button>
                </div>
              </section>
            );
          })}
          <Link
            href="/sport/szablony/nowy"
            className="flex min-h-[180px] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#eaeaea] bg-white text-[#666666] no-underline hover:text-[#171717]"
          >
            <span className="text-[22px] leading-none">+</span> Nowy szablon
          </Link>
        </div>
      </div>
    </div>
  );
}
