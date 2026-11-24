"use client";

import * as React from "react";
import { Check } from "lucide-react";

import { Button, Card, FIELD, FormDialog } from "@/components/controls";
import { cn } from "@/lib/utils";
import { FIELD_TYPE_META, type FieldType, type PageField } from "../fields";
import { computeCard, type PageRow, type PinnedCard } from "../table-model";
import { OptionBadge } from "./option-badge";

type Sposob = PinnedCard["aggregation"];

// Sposoby liczenia według typu kolumny (AGGS z S2CardDialog.dc.html); typy spoza listy nie mają kart
const SPOSOBY: Partial<
  Record<FieldType, { key: Sposob; label: string; desc: string }[]>
> = {
  status: [
    {
      key: "count_option",
      label: "Liczba wierszy z opcją",
      desc: "np. „Czytam teraz: 2”",
    },
    {
      key: "count_option_of_total",
      label: "Ile z wszystkich",
      desc: "np. „Przeczytane: 7 / 11”",
    },
    {
      key: "count_option_in_year",
      label: "Liczba z opcją w tym roku",
      desc: "np. „Przeczytane w 2026: 6”",
    },
  ],
  select: [
    {
      key: "count_option",
      label: "Liczba wierszy z opcją",
      desc: "np. „Czytam teraz: 2”",
    },
    {
      key: "count_option_of_total",
      label: "Ile z wszystkich",
      desc: "np. „Przeczytane: 7 / 11”",
    },
    {
      key: "count_option_in_year",
      label: "Liczba z opcją w tym roku",
      desc: "np. „Przeczytane w 2026: 6”",
    },
  ],
  rating: [
    { key: "avg", label: "Średnia", desc: "np. „Średnia ocena: 4,1 / 5”" },
  ],
  date: [
    {
      key: "nearest_date",
      label: "Najbliższa data",
      desc: "najbliższy przyszły termin w kolumnie",
    },
  ],
  // Kwota cykliczna i Data odnowienia (spec Subscriptions, punkt 3)
  recurring: [
    {
      key: "sum_month",
      label: "Suma na miesiąc",
      desc: "np. „Σ miesięcznie: 437,94 zł”",
    },
    {
      key: "sum_year",
      label: "Suma na rok",
      desc: "np. „Σ rocznie: 5 255,28 zł”",
    },
  ],
  renewal: [
    {
      key: "next_renewal",
      label: "Najbliższe odnowienie",
      desc: "najbliższa przyszła data wg cyklu",
    },
  ],
  text: [
    {
      key: "count_distinct",
      label: "Liczba różnych wartości",
      desc: "np. „Autorzy: 9”",
    },
  ],
};

// Przycisk wyboru (.chip z coss.css): 28 px, zaznaczony ciemny jak w makiecie S2CardDialog
const CHIP =
  "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-[8px] border border-input bg-white px-[9px] text-sm font-medium whitespace-nowrap text-foreground shadow-xs outline-none transition-[box-shadow,background-color] duration-150 hover:bg-panel focus-visible:shadow-focus max-[799px]:h-9 max-[799px]:px-3.5";
const CHIP_WYBRANY =
  "border-primary bg-primary text-primary-foreground shadow-none hover:bg-primary-hover";
const ETYKIETA_SEKCJI = "text-sm font-medium text-foreground";

// Okno „Nowa karta” i „Edytuj kartę” (S2CardDialog.dc.html): kolumna, sposób liczenia, opcja / rok, napis i podgląd.
// Stan startowy powstaje przy montowaniu, więc rodzic montuje okno dopiero po otwarciu.
export function CardDialog({
  open,
  tableName,
  fields,
  rows,
  today,
  initial,
  onCancel,
  onSave,
}: {
  open: boolean;
  tableName: string;
  fields: PageField[];
  rows: PageRow[];
  today: string;
  // null = nowa karta; inaczej edycja (zachowuje width i unit)
  initial: PinnedCard | null;
  onCancel: () => void;
  onSave: (card: PinnedCard) => void;
}) {
  // Kolumny, z których da się policzyć kartę, w kolejności tabeli
  const dostepne = fields.filter((f) => SPOSOBY[f.type] !== undefined);
  const polaDat = fields.filter((f) => f.type === "date");
  // Opcje „zrobione” przy najbliższej dacie pochodzą z pierwszej kolumny status
  const statusPola = fields.find((f) => f.type === "status");
  const tytulPola = fields.find((f) => f.isTitle);

  // Stan startowy: karta wskazująca usunięte pole (albo sposób, którego kolumna już nie obsługuje) otwiera się na pierwszej kolumnie
  const [w, setW] = React.useState(() => {
    // Najbliższa data trzyma w field_id kolumnę status, a kolumną karty jest date_field_id
    const idPola =
      initial?.aggregation === "nearest_date"
        ? initial.date_field_id
        : initial?.field_id;
    const trafiona = initial
      ? dostepne.find((f) => f.id === idPola)
      : undefined;
    const pole = trafiona ?? dostepne[0];
    const sposoby = pole ? (SPOSOBY[pole.type] ?? []) : [];
    const opcje = pole?.config.options ?? [];
    const pierwszaData = polaDat[0]?.id ?? "";
    const dataKarty =
      polaDat.find((f) => f.id === initial?.date_field_id)?.id ?? pierwszaData;
    let sposob: Sposob | "" = sposoby[0]?.key ?? "";
    if (
      trafiona &&
      initial &&
      sposoby.some((s) => s.key === initial.aggregation)
    ) {
      sposob = initial.aggregation;
    }
    // Rok liczony bez kolumny daty nie działa: wracamy do pierwszego sposobu
    if (sposob === "count_option_in_year" && dataKarty === "")
      sposob = sposoby[0].key;
    // Zapisana opcja już nie istnieje: jak przy nietrafionej kolumnie czyścimy też napis
    const opcjaZniknela =
      initial?.option_id !== undefined &&
      !opcje.some((o) => o.id === initial.option_id);
    return {
      fieldId: pole?.id ?? "",
      agg: sposob,
      optId:
        (trafiona && opcje.find((o) => o.id === initial?.option_id)?.id) ??
        opcje[0]?.id ??
        "",
      dateId: dataKarty,
      doneId:
        statusPola?.config.options?.find(
          (o) => o.id === initial?.done_option_id,
        )?.id ?? "",
      label: trafiona && initial && !opcjaZniknela ? initial.label : "",
    };
  });

  // Telefon (CMCardSheet): nagłówek „Anuluj · tytuł · Dodaj / Zapisz” zamiast stopki, podgląd karty na górze.
  // Okno montuje się dopiero po otwarciu (po stronie klienta), więc szerokość sprawdzamy raz przy montowaniu.
  const [telefon] = React.useState(
    () => typeof window.matchMedia === "function" && window.matchMedia("(max-width: 799px)").matches,
  );

  const pole = dostepne.find((f) => f.id === w.fieldId);
  const sposoby = pole ? (SPOSOBY[pole.type] ?? []) : [];
  const opcje = pole?.config.options ?? [];
  const opcjeZrobione = statusPola?.config.options ?? [];
  const sposob = w.agg;
  const potrzebaOpcji =
    sposob === "count_option" ||
    sposob === "count_option_of_total" ||
    sposob === "count_option_in_year";
  const potrzebaZrobione =
    sposob === "nearest_date" && statusPola !== undefined;
  const potrzebaDaty = sposob === "count_option_in_year";

  // Domyślny napis (defLabel z makiety)
  const nazwaOpcji = opcje.find((o) => o.id === w.optId)?.label ?? "";
  let napisDomyslny = "";
  if (pole) {
    if (sposob === "count_option_in_year")
      napisDomyslny = `${nazwaOpcji} w {year}`;
    else if (sposob === "avg")
      napisDomyslny = `Średnia: ${pole.name.toLowerCase()}`;
    else if (sposob === "nearest_date")
      napisDomyslny = `Najbliższa: ${pole.name.toLowerCase()}`;
    else if (sposob === "count_distinct") napisDomyslny = pole.name;
    // Napisy kart szablonu Subscriptions (S2Main)
    else if (sposob === "sum_month") napisDomyslny = "Σ miesięcznie";
    else if (sposob === "sum_year") napisDomyslny = "Σ rocznie";
    else if (sposob === "next_renewal") napisDomyslny = "Najbliższe odnowienie";
    else napisDomyslny = nazwaOpcji;
  }

  // Karta z bieżących wyborów; to ona idzie do podglądu i do zapisu
  let karta: PinnedCard | null = null;
  if (pole && sposob) {
    karta = {
      label: w.label.trim() === "" ? napisDomyslny : w.label.trim(),
      field_id: pole.id,
      aggregation: sposob,
    };
    if (potrzebaOpcji) karta.option_id = w.optId;
    if (potrzebaDaty) karta.date_field_id = w.dateId;
    if (sposob === "nearest_date") {
      // computeCard porównuje „zrobione” z kolumną field_id, więc tu idzie kolumna status (bez niej sama data)
      karta.field_id = statusPola?.id ?? pole.id;
      karta.date_field_id = pole.id;
      if (tytulPola) karta.title_field_id = tytulPola.id;
      if (w.doneId !== "") karta.done_option_id = w.doneId;
    }
    if (initial?.width !== undefined) karta.width = initial.width;
    // Odmiana jednostki ma sens tylko dla tego samego sposobu liczenia
    if (initial?.unit !== undefined && initial.aggregation === sposob)
      karta.unit = initial.unit;
  }
  const wynik = karta ? computeCard(karta, fields, rows, today) : null;
  const mozeDodac =
    karta !== null &&
    (!potrzebaOpcji || w.optId !== "") &&
    (!potrzebaDaty || w.dateId !== "");

  const naglowek = telefon
    ? {
        phoneHeader: "actions" as const,
        phoneCancel: { label: "Anuluj", onClick: onCancel },
        phoneSubmit: (
          <Button
            variant="primary"
            disabled={!mozeDodac}
            onClick={() => {
              if (karta) onSave(karta);
            }}
          >
            {initial ? "Zapisz" : "Dodaj"}
          </Button>
        ),
      }
    : { phoneHeader: "close" as const };

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
      wide
      title={initial ? "Edytuj kartę" : "Nowa karta"}
      description={`Liczba policzona z kolumny tabeli „${tableName}”.`}
      {...naglowek}
      // Na telefonie przyciski są w nagłówku, więc stopki nie ma w DOM (bez dubli „Anuluj” i „Zapisz”)
      footer={
        telefon ? undefined : (
          <>
            <Button variant="ghost" onClick={onCancel}>
              Anuluj
            </Button>
            <Button
              variant="primary"
              disabled={!mozeDodac}
              onClick={() => {
                if (karta) onSave(karta);
              }}
            >
              {initial ? "Zapisz" : "Dodaj kartę"}
            </Button>
          </>
        )
      }
    >
      {dostepne.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">
          Ta tabela nie ma kolumny, z której da się policzyć kartę.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <span id="karta-kolumna" className={ETYKIETA_SEKCJI}>
              Kolumna
            </span>
            <div
              role="radiogroup"
              aria-labelledby="karta-kolumna"
              className="flex flex-wrap gap-1.5"
            >
              {dostepne.map((f) => {
                const Ikona = FIELD_TYPE_META[f.type].Icon;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="radio"
                    aria-checked={f.id === w.fieldId}
                    className={cn(CHIP, f.id === w.fieldId && CHIP_WYBRANY)}
                    onClick={() =>
                      // Nowa kolumna: pierwszy sposób, pierwsza opcja i czysty napis
                      setW({
                        ...w,
                        fieldId: f.id,
                        agg: (SPOSOBY[f.type] ?? [])[0].key,
                        optId: f.config.options?.[0]?.id ?? "",
                        label: "",
                      })
                    }
                  >
                    <Ikona aria-hidden="true" size={14} />
                    {f.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span id="karta-sposob" className={ETYKIETA_SEKCJI}>
              Co policzyć
            </span>
            <div
              role="radiogroup"
              aria-labelledby="karta-sposob"
              className="flex flex-col gap-px rounded-xl border border-border bg-white p-1"
            >
              {sposoby.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  role="radio"
                  aria-checked={s.key === sposob}
                  // Rok liczony z kolumny daty: bez takiej kolumny sposób jest wyłączony
                  disabled={
                    s.key === "count_option_in_year" && polaDat.length === 0
                  }
                  className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-md border-0 bg-transparent px-2.5 text-left text-sm outline-none hover:bg-accent focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-[.64] disabled:hover:bg-transparent"
                  onClick={() => setW({ ...w, agg: s.key })}
                >
                  <span className="flex flex-col gap-px">
                    <span className="font-medium">{s.label}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {s.desc}
                    </span>
                  </span>
                  {s.key === sposob && (
                    <Check aria-hidden="true" size={14} className="flex-none" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {potrzebaOpcji && (
            <div className="flex flex-col gap-2">
              <span id="karta-opcja" className={ETYKIETA_SEKCJI}>
                Opcja
              </span>
              {opcje.length === 0 ? (
                <p className="m-0 text-sm text-muted-foreground">
                  Ta kolumna nie ma jeszcze opcji.
                </p>
              ) : (
                <div
                  role="radiogroup"
                  aria-labelledby="karta-opcja"
                  className="flex flex-wrap gap-1.5"
                >
                  {opcje.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      role="radio"
                      aria-checked={o.id === w.optId}
                      aria-label={o.label}
                      className={cn(
                        "cursor-pointer rounded-full border-0 bg-transparent p-0.5 outline-none focus-visible:shadow-focus",
                        o.id === w.optId &&
                          "shadow-[0_0_0_2px_#fff,0_0_0_4px_#262626]",
                      )}
                      onClick={() => setW({ ...w, optId: o.id })}
                    >
                      <OptionBadge option={o} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {potrzebaZrobione && (
            <div className="flex flex-col gap-2">
              <span id="karta-zrobione" className={ETYKIETA_SEKCJI}>
                Pomiń wiersze z opcją
              </span>
              <div
                role="radiogroup"
                aria-labelledby="karta-zrobione"
                className="flex flex-wrap gap-1.5"
              >
                {[
                  { id: "", label: "— żadna —", color: "" },
                  ...opcjeZrobione,
                ].map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={o.id === w.doneId}
                    aria-label={o.label}
                    className={cn(
                      "cursor-pointer rounded-full border-0 bg-transparent p-0.5 outline-none focus-visible:shadow-focus",
                      o.id === w.doneId &&
                        "shadow-[0_0_0_2px_#fff,0_0_0_4px_#262626]",
                    )}
                    onClick={() => setW({ ...w, doneId: o.id })}
                  >
                    <OptionBadge option={o} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {potrzebaDaty && (
            <div className="flex flex-col gap-2">
              <span id="karta-data" className={ETYKIETA_SEKCJI}>
                Rok liczony z kolumny
              </span>
              <div
                role="radiogroup"
                aria-labelledby="karta-data"
                className="flex flex-wrap gap-1.5"
              >
                {polaDat.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="radio"
                    aria-checked={f.id === w.dateId}
                    className={cn(CHIP, f.id === w.dateId && CHIP_WYBRANY)}
                    onClick={() => setW({ ...w, dateId: f.id })}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label htmlFor="karta-napis" className={ETYKIETA_SEKCJI}>
              Napis
            </label>
            <input
              id="karta-napis"
              type="text"
              className={FIELD}
              maxLength={80}
              value={w.label}
              placeholder={napisDomyslny}
              aria-describedby="karta-napis-podpowiedz"
              onChange={(e) => setW({ ...w, label: e.target.value })}
            />
            <span
              id="karta-napis-podpowiedz"
              className="text-xs font-normal text-muted-foreground"
            >
              „{"{year}"}” pokaże bieżący rok.
            </span>
          </div>

          <div className="flex flex-col gap-2 max-[799px]:order-first">
            <span className="text-xs font-medium text-muted-foreground">
              Podgląd
            </span>
            <Card
              data-testid="podglad-karty"
              className="w-60 max-w-full px-[18px] py-4 max-[799px]:w-full"
            >
              <div className="text-xs font-medium text-muted-foreground">
                {wynik?.label}
              </div>
              <div className="mt-2 text-[26px] font-semibold tracking-[-0.02em] tabular-nums">
                <span>{wynik?.value ?? "—"}</span>
                {wynik?.sub && (
                  <>
                    {" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      {wynik.sub}
                    </span>
                  </>
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </FormDialog>
  );
}
