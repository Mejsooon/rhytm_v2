"use client";

// Lista szablonów treningów (WorkoutTemplates.dc.html, widok listy): ścieżka „Sport / Szablony treningów”,
// „Nowy szablon”, zielony komunikat po zapisie / usunięciu, karty szablonów i karta „+ Nowy szablon”.
// Jedno drzewo dla webu i telefonu (CMWorkoutTemplates): poniżej 800 px nagłówek .m-head ze strzałką do Sportu
// i „+”, karty z liczbą ćwiczeń, listą ćwiczeń, dniami i godziną oraz stopką „Edytuj” / „Rozpocznij”.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheckIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { SidebarToggle } from "@/components/shell/sidebar-toggle";
import { Button, StatusBadge } from "@/components/controls";
import { ModuleHeader } from "@/components/shell/module-header";
import { formatClockTime } from "@/lib/time/timezones";
import { createGymSession } from "./actions";
import type { TemplatesData } from "./load-sport";
import { formatLastUsed, plPlural } from "./model";

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";
// Dni w meta karty jak chipy edytora (1 = pn … 7 = nd)
const DNI = ["", "Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"];
// Dni w opisie karty na telefonie (CMWorkoutTemplates: „pn, czw · 17:00”)
const DNI_TELEFON = ["", "pn", "wt", "śr", "czw", "pt", "sob", "nd"];

export function TemplatesList({
  data,
  flash,
}: {
  data: TemplatesData;
  // Tekst zielonego komunikatu z adresu (?komunikat=…&nazwa=…) albo null
  flash: string | null;
}) {
  const router = useRouter();

  // Komunikat jest jednorazowy: po pokazaniu zastępujemy adres listą bez ?komunikat/&nazwa,
  // więc odświeżenie go nie powtórzy. Treść trzymamy w stanie, bo po zamianie adresu serwer odda flash = null.
  // Kolejny zapis (także tego samego szablonu) zmienia flash z null na tekst i pokazuje go znowu.
  const [komunikat, setKomunikat] = useState(flash);
  const [poprzedniFlash, setPoprzedniFlash] = useState(flash);
  if (flash !== poprzedniFlash) {
    setPoprzedniFlash(flash);
    if (flash) setKomunikat(flash);
  }
  useEffect(() => {
    if (flash) router.replace("/sport/szablony", { scroll: false });
  }, [flash, router]);

  // „Rozpocznij” = wystąpienie szablonu z dziś (akcja idempotentna). W trakcie wszystkie „Rozpocznij” są
  // zablokowane, a kliknięty ma aria-busy; ref chroni przed podwójnym kliknięciem przed ponownym renderem.
  const tworzy = useRef(false);
  const [startuje, setStartuje] = useState<string | null>(null);
  async function rozpocznij(templateId: string, startTime: string) {
    if (tworzy.current) return;
    tworzy.current = true;
    setStartuje(templateId);
    try {
      const wynik = await createGymSession({
        date: data.today,
        start: startTime.slice(0, 5),
        templateId,
      });
      if (wynik.ok && wynik.id) {
        // Zostajemy w stanie „w trakcie” aż do przejścia na ekran treningu
        router.push(`/sport/trening/${wynik.id}`);
        return;
      }
      toast.error(wynik.ok ? BLAD_ZAPISU : wynik.message);
    } catch {
      toast.error(BLAD_ZAPISU);
    }
    tworzy.current = false;
    setStartuje(null);
  }

  return (
    <div className="flex min-w-0 flex-col">
      {/* Telefon: .m-head z CMWorkoutTemplates (wstecz do Sportu, tytuł na środku, „Nowy szablon”) */}
      <ModuleHeader
        title="Szablony treningów"
        phoneOnly
        phoneCenterTitle
        phoneBack={{ href: "/sport", label: "Wstecz" }}
        phoneActions={
          <Button variant="ghost" icon asChild>
            <Link href="/sport/szablony/nowy" aria-label="Nowy szablon">
              <PlusIcon aria-hidden="true" className="size-5" />
            </Link>
          </Button>
        }
      />
      {/* .topbar z okruszkami .crumb (CWorkoutTemplates) */}
      <header className="box-content flex min-h-9 flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-2.5 max-[799px]:hidden">
        <nav
          aria-label="Okruszki"
          className="flex items-center gap-1.5 text-sm text-muted-foreground"
        >
          {/* Przy schowanym pasku: przycisk „Pokaż pasek boczny” przed okruszkami */}
          <SidebarToggle placement="header" />
          <Link
            href="/sport"
            className="text-muted-foreground no-underline outline-none hover:text-foreground focus-visible:shadow-focus max-[799px]:inline-flex max-[799px]:min-h-11 max-[799px]:items-center"
          >
            Sport
          </Link>
          <span aria-hidden="true">/</span>
          <span className="font-medium text-foreground">
            Szablony treningów
          </span>
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="primary">
            <Link href="/sport/szablony/nowy">
              <PlusIcon aria-hidden="true" className="size-4" />
              Nowy szablon
            </Link>
          </Button>
        </div>
      </header>

      <div className="box-border flex w-full flex-col gap-6 px-6 py-7 max-[799px]:gap-3.5 max-[799px]:px-4 max-[799px]:pt-4 max-[799px]:pb-6">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-[-0.02em] max-[799px]:hidden">
            Szablony treningów
          </h1>
          <p className="m-0 mt-1.5 text-sm text-muted-foreground max-[799px]:mt-0 max-[799px]:text-xs">
            Gotowa lista ćwiczeń i serii. „Rozpocznij” tworzy trening z
            wypełnionymi ciężarami z ostatniego razu.
          </p>
        </div>

        {komunikat && (
          // .alert.ok: zielona ramka, ikona i delikatne tło
          <div
            role="status"
            className="flex items-center gap-2.5 rounded-lg border border-success-border bg-success/[.04] px-3.5 py-3 text-sm text-foreground"
          >
            <CircleCheckIcon
              aria-hidden="true"
              className="size-4 flex-none text-success"
            />
            <span>{komunikat}</span>
          </div>
        )}

        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 max-[799px]:grid-cols-1 max-[799px]:gap-3.5">
          {data.templates.map((t) => {
            const naglowekId = `szablon-${t.id}`;
            const serie = t.items.reduce((a, i) => a + i.sets_count, 0);
            const dni = [...t.weekdays].sort((a, b) => a - b);
            const meta = `${plPlural(t.items.length, "ćwiczenie", "ćwiczenia", "ćwiczeń")} · ${plPlural(serie, "seria", "serie", "serii")}${dni.length ? ` · ${dni.map((d) => DNI[d]).join(", ")}` : ""}`;
            // Telefon: „pn, czw · 17:00” albo „bez stałego dnia”
            const godzinaStartu = formatClockTime(
              Number(t.start_time.slice(0, 2)),
              Number(t.start_time.slice(3, 5)),
              data.profile.clock,
            );
            const kiedy = dni.length
              ? `${dni.map((d) => DNI_TELEFON[d]).join(", ")} · ${godzinaStartu}`
              : "bez stałego dnia";
            return (
              <section
                key={t.id}
                aria-labelledby={naglowekId}
                // .card z coss.css (jak Card, ale jako region)
                className="relative flex flex-col rounded-xl border border-border bg-white bg-clip-padding shadow-card"
              >
                <div className="flex items-center justify-between gap-3 px-6 pt-5">
                  <span
                    id={naglowekId}
                    className="min-w-0 truncate text-base leading-[1.3] font-semibold max-[799px]:flex-1 max-[799px]:text-[17px]"
                  >
                    {t.name}
                  </span>
                  <StatusBadge
                    tone="gray"
                    className="shrink-0 tabular-nums max-[799px]:hidden"
                  >
                    {`ostatnio: ${formatLastUsed(t.last_used_at, data.profile.timezone)}`}
                  </StatusBadge>
                  <StatusBadge
                    tone="gray"
                    className="hidden shrink-0 tabular-nums max-[799px]:inline-flex"
                  >
                    {plPlural(
                      t.items.length,
                      "ćwiczenie",
                      "ćwiczenia",
                      "ćwiczeń",
                    )}
                  </StatusBadge>
                </div>
                <div className="flex flex-1 flex-col gap-2 px-6 pt-2 max-[799px]:gap-1.5 max-[799px]:pb-4">
                  <span className="text-xs text-muted-foreground tabular-nums max-[799px]:hidden">
                    {meta}
                  </span>
                  <span className="hidden text-[13px] text-muted-foreground max-[799px]:block">
                    {t.items.length
                      ? t.items.map((i) => i.exerciseName).join(" · ")
                      : "Szablon bez ćwiczeń"}
                  </span>
                  <span className="hidden text-xs text-muted-foreground tabular-nums max-[799px]:block">
                    {kiedy}
                  </span>
                  <div className="flex flex-wrap gap-1 max-[799px]:hidden">
                    {t.items.length ? (
                      t.items.map((i, idx) => (
                        <StatusBadge
                          key={`${i.exerciseName}-${idx}`}
                          tone="outline"
                          className="max-w-full"
                        >
                          <span className="min-w-0 truncate">
                            {i.exerciseName}
                          </span>
                        </StatusBadge>
                      ))
                    ) : (
                      <StatusBadge tone="outline">Brak ćwiczeń</StatusBadge>
                    )}
                  </div>
                </div>
                {/* Telefon: .foot — „Edytuj” po lewej (ghost), „Rozpocznij” po prawej */}
                <div className="flex gap-2 px-6 pt-4 pb-5 max-[799px]:flex-row-reverse max-[799px]:justify-between max-[799px]:rounded-b-[15px] max-[799px]:border-t max-[799px]:border-border max-[799px]:bg-black/[.025] max-[799px]:py-3.5">
                  <Button
                    variant="primary"
                    size="sm"
                    className="max-[799px]:h-11"
                    disabled={startuje !== null}
                    aria-busy={startuje === t.id ? true : undefined}
                    onClick={() => void rozpocznij(t.id, t.start_time)}
                  >
                    Rozpocznij
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    className="max-[799px]:h-11 max-[799px]:border-transparent max-[799px]:bg-transparent max-[799px]:text-muted-foreground max-[799px]:shadow-none"
                  >
                    <Link href={`/sport/szablony/${t.id}`}>Edytuj</Link>
                  </Button>
                </div>
              </section>
            );
          })}
          {/* .card z przerywaną ramką: ikona w ramce .empty-ic i podpis */}
          <Link
            href="/sport/szablony/nowy"
            aria-label="+ Nowy szablon"
            className="flex min-h-[190px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed max-[799px]:hidden border-border bg-transparent text-sm text-muted-foreground no-underline outline-none hover:text-foreground focus-visible:shadow-focus"
          >
            <span className="grid size-10 place-items-center rounded-md border border-border bg-white text-muted-foreground shadow-xs">
              <PlusIcon aria-hidden="true" className="size-4" />
            </span>
            Nowy szablon
          </Link>
        </div>
      </div>
    </div>
  );
}
