"use client";

// Szczegóły ćwiczenia na telefonie wg CMExerciseDetail.dc.html: nagłówek ze strzałką, karta „Szacowany 1RM”
// (duża liczba, zmiana z 8 tygodni, segment Szac. 1RM · Objętość i 8 słupków tygodniowych), „Rekordy” i „Historia”.
// Dane liczy ExerciseDetail (te same co na webie); tu tylko wygląd. „Z masą ciała” i „Zmień nazwę” nie mają
// miejsca w makiecie, więc są w nagłówku (ołówek) i w wierszu pod historią.
import { useState } from "react";
import { PencilIcon } from "lucide-react";

import {
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Segment,
  StatusBadge,
  Switch,
} from "@/components/controls";
import { ModuleHeader } from "@/components/shell/module-header";

export type TydzienWykresu = {
  etykieta: string; // „tydz. 46”
  rm: number | null; // najlepszy szac. 1RM tygodnia
  objetosc: number | null; // suma kg × powt. zrobionych serii tygodnia
};

export type WierszHistorii = {
  id: string;
  dzien: string; // „czw 12.11”
  serie: string; // „60×8 · 60×8 · 62,5×6”
  rm: string; // „82,5 kg” albo „—”
};

export function MExerciseDetail({
  nazwa,
  rm,
  zmiana,
  tygodnie,
  najciezsza,
  najwiecejPowt,
  najlepsza,
  wiersze,
  nazwaSzablonu,
  zMasaCiala,
  onToggleBodyweight,
  onRename,
}: {
  nazwa: string;
  // Najlepszy szac. 1RM jako „82,5” albo null
  rm: string | null;
  // Zmiana z 8 tygodni (kg) albo null
  zmiana: { tekst: string; znak: -1 | 0 | 1 } | null;
  tygodnie: TydzienWykresu[];
  najciezsza: string | null;
  najwiecejPowt: string | null;
  najlepsza: { tekst: string; rekord: boolean } | null;
  wiersze: WierszHistorii[];
  nazwaSzablonu: string | null;
  zMasaCiala: boolean;
  onToggleBodyweight: (v: boolean) => void;
  onRename: () => void;
}) {
  const [metryka, setMetryka] = useState<"rm" | "obj">("rm");

  // Słupki: wysokość od 90% minimum do maksimum (jak renderVals makiety); tydzień bez danych to niski szary pasek
  const wartosci = tygodnie.map((t) => (metryka === "rm" ? t.rm : t.objetosc));
  const znane = wartosci.filter((v): v is number => v !== null);
  const min = Math.min(...znane) * 0.9;
  const max = Math.max(...znane);
  // Ostatni tydzień z danymi jest wyróżniony kolorem głównym
  const ostatniZDanymi = wartosci.reduce((a, v, i) => (v !== null ? i : a), -1);

  return (
    <div className="flex min-w-0 flex-col min-[800px]:hidden">
      <ModuleHeader
        title={nazwa}
        phoneOnly
        phoneCenterTitle
        phoneBack={{ href: "/sport", label: "Wstecz" }}
        phoneActions={
          <Button
            variant="ghost"
            icon
            aria-label="Zmień nazwę ćwiczenia"
            onClick={onRename}
          >
            <PencilIcon size={18} aria-hidden="true" />
          </Button>
        }
      />
      <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
        <Card role="region" aria-labelledby="m-cwiczenie-1rm">
          <div className="flex flex-col gap-1 px-6 py-5">
            <span
              id="m-cwiczenie-1rm"
              className="text-xs font-medium text-muted-foreground"
            >
              Szacowany 1RM
            </span>
            <div className="flex items-baseline gap-2.5">
              <span className="text-[30px] font-semibold tabular-nums">
                {rm === null ? "—" : `${rm} kg`}
              </span>
              {zmiana !== null && (
                <StatusBadge
                  tone={
                    zmiana.znak > 0 ? "green" : zmiana.znak < 0 ? "red" : "gray"
                  }
                  className="tabular-nums"
                >
                  {`${zmiana.tekst} · 8 tyg.`}
                </StatusBadge>
              )}
            </div>
          </div>
          <div className="mx-3.5 mb-2.5">
            <Segment
              ariaLabel="Metryka"
              value={metryka}
              onChange={setMetryka}
              options={[
                { value: "rm", label: "Szac. 1RM" },
                { value: "obj", label: "Objętość" },
              ]}
            />
          </div>
          {znane.length === 0 ? (
            <p className="m-0 px-3.5 pb-3 text-sm text-muted-foreground">
              Brak danych w tym okresie.
            </p>
          ) : (
            <>
              <div
                role="img"
                aria-label={`${metryka === "rm" ? "Szacowany 1RM" : "Objętość"} w ostatnich 8 tygodniach`}
                className="grid h-[120px] grid-cols-8 items-end gap-1.5 px-3.5 pb-1.5"
              >
                {wartosci.map((v, i) => (
                  <span
                    key={tygodnie[i].etykieta}
                    className={`block rounded-t-[4px] ${
                      v === null
                        ? "bg-black/[.06]"
                        : i === ostatniZDanymi
                          ? "bg-primary"
                          : "bg-black/[.14]"
                    }`}
                    style={{
                      height: `${
                        v === null
                          ? 3
                          : max === min
                            ? 100
                            : Math.max(
                                3,
                                Math.round(((v - min) / (max - min)) * 100),
                              )
                      }%`,
                    }}
                  />
                ))}
              </div>
              <div className="flex justify-between px-3.5 pb-3 text-[11px] text-muted-foreground tabular-nums">
                <span>{tygodnie[0].etykieta}</span>
                <span>{tygodnie[tygodnie.length - 1].etykieta}</span>
              </div>
            </>
          )}
        </Card>

        <Card role="region" aria-labelledby="m-cwiczenie-rekordy">
          <CardHeader className="px-4">
            <CardTitle as="h2" id="m-cwiczenie-rekordy">
              Rekordy
            </CardTitle>
          </CardHeader>
          <div className="py-1">
            <div className="m-row">
              <span className="flex-1 text-muted-foreground">
                Najcięższa seria
              </span>
              <span className="font-medium tabular-nums">
                {najciezsza ?? "—"}
              </span>
            </div>
            <div className="m-row">
              <span className="flex-1 text-muted-foreground">
                Najwięcej powt.
              </span>
              <span className="font-medium tabular-nums">
                {najwiecejPowt ?? "—"}
              </span>
            </div>
            <div className="m-row">
              <span className="flex-1 text-muted-foreground">
                Najlepsza seria (szac. 1RM)
              </span>
              <span className="flex items-center gap-1.5 font-medium tabular-nums">
                {najlepsza?.tekst ?? "—"}
                {najlepsza?.rekord && (
                  <StatusBadge tone="green">REKORD</StatusBadge>
                )}
              </span>
            </div>
          </div>
        </Card>

        <Card role="region" aria-labelledby="m-cwiczenie-historia">
          <CardHeader className="px-4">
            <div>
              <CardTitle as="h2" id="m-cwiczenie-historia">
                Historia
              </CardTitle>
              {nazwaSzablonu && (
                <CardDescription>{`w szablonie „${nazwaSzablonu}”`}</CardDescription>
              )}
            </div>
          </CardHeader>
          <div className="py-1">
            {wiersze.length === 0 && (
              <p className="m-0 px-4 py-3 text-sm text-muted-foreground">
                Brak zrobionych serii tego ćwiczenia.
              </p>
            )}
            {wiersze.map((w) => (
              <div key={w.id} className="m-row min-h-14">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium tabular-nums">
                    {w.dzien}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {w.serie}
                  </span>
                </span>
                <span className="text-[13px] text-muted-foreground tabular-nums">
                  {w.rm}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="m-row">
            <span className="flex-1">Z masą ciała</span>
            <Switch
              checked={zMasaCiala}
              onChange={onToggleBodyweight}
              ariaLabel="Z masą ciała"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
