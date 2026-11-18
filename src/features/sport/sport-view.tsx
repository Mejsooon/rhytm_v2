"use client";

// Ekran „Sport” na komputerze (Sport.dc.html): nagłówek z ‹ Dziś ›, filtrem i przyciskami,
// kalendarz miesiąca z „Σ tydz.”, legenda, kafelki z wykresem, karta rekordu i ostatnie treningi.
// Telefon (MSport) dojdzie osobno; drzewo web jest ukryte poniżej 800 px.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ActionPopover, Button, Segment } from "@/components/controls";
import { MIESIACE, type IsoDate } from "@/components/controls/calendar-math";
import { minutesNow } from "@/features/calendar/load-calendar";
import { createGymSession, type GymSessionInput } from "./actions";
import { DeleteSessionDialog } from "./delete-session-dialog";
import type { RunRequest } from "./item-popover";
import type { SportMonthData } from "./load-sport";
import type { SportItem } from "./model";
import { MonthCalendar } from "./month-calendar";
import { RecentTable } from "./recent-table";
import { RecordCard } from "./record-card";
import { RunDialog } from "./run-dialog";
import { WeekTiles } from "./week-tiles";

type Filtr = "all" | "run" | "gym";

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";
const OPCJA =
  "flex w-full cursor-pointer items-center rounded-md border-0 bg-transparent px-2.5 py-[7px] text-left text-[13px] text-[#171717] no-underline outline-none hover:bg-[#f5f5f5] hover:text-[#171717] focus-visible:bg-[#f5f5f5]";

export function SportView({
  data,
  selectedKey,
  newGym,
  runId = null,
  newRun = null,
  runItem = null,
}: {
  data: SportMonthData;
  // ?wybrany={klucz} (z kalendarza głównego) — dymek tego treningu otwarty od razu
  selectedKey: string | null;
  // ?nowy=silownia&data&godzina — pusty trening do utworzenia od razu (null w polu = dziś / teraz)
  newGym: { date: IsoDate | null; start: string | null } | null;
  // ?bieg={id} — okno biegu do edycji / uzupełnienia (bieg z wczytanego miesiąca albo `runItem`)
  runId?: string | null;
  // ?nowy=bieg&data&godzina — okno nowego biegu (null w polu = dziś / teraz)
  newRun?: { date: IsoDate | null; start: string | null } | null;
  // Bieg z `?bieg=` spoza wczytanych danych (wczytany po stronie serwera)
  runItem?: SportItem | null;
}) {
  const router = useRouter();
  const { profile, month, today } = data;

  const [filtr, setFiltr] = useState<Filtr>("all");
  const [wybrany, setWybrany] = useState<string | null>(selectedKey);
  const [dodaj, setDodaj] = useState<IsoDate | null>(null);
  const [doUsuniecia, setDoUsuniecia] = useState<SportItem | null>(null);
  const [menuSilowni, setMenuSilowni] = useState(false);

  // Nowe dane z serwera (Next 16 Activity trzyma trasę w pamięci — stan ustawiany w renderze):
  // `wybrany` w adresie otwiera swój dymek (także przy ponownym wejściu z kalendarza), a inny miesiąc zamyka dymki.
  const [daneDla, setDaneDla] = useState(data);
  if (daneDla !== data) {
    setDaneDla(data);
    if (selectedKey) {
      setWybrany(selectedKey);
      setDodaj(null);
    } else if (daneDla.month !== data.month) {
      setWybrany(null);
      setDodaj(null);
    }
  }
  // Trening usunięty (albo spoza danych) nie ma dymka
  if (wybrany !== null && !data.items.some((i) => i.key === wybrany)) {
    setWybrany(null);
  }

  // Nieaktualny `?wybrany=` znika z adresu, gdy dymek jest już zamknięty (inaczej każde odświeżenie
  // danych z serwera otwierałoby go znowu). Klucz zamykany raz, żeby nie powtarzać nawigacji.
  const wyczyszczonyKlucz = useRef<string | null>(null);
  useEffect(() => {
    if (selectedKey === null) {
      wyczyszczonyKlucz.current = null;
      return;
    }
    if (wybrany === selectedKey || wyczyszczonyKlucz.current === selectedKey)
      return;
    wyczyszczonyKlucz.current = selectedKey;
    router.replace(`/sport?miesiac=${month}`, { scroll: false });
  }, [selectedKey, wybrany, month, router]);

  // Okno biegu wynika z adresu; zamknięcie czyści adres (miesiąc zostaje) i chowa okno od razu
  const kluczBiegu = runId
    ? `b|${runId}`
    : newRun
      ? `n|${newRun.date ?? ""}|${newRun.start ?? ""}`
      : null;
  const [zamknietyBieg, setZamknietyBieg] = useState<string | null>(null);
  if (zamknietyBieg !== null && kluczBiegu !== zamknietyBieg) {
    setZamknietyBieg(null);
  }
  const edytowanyBieg = runId
    ? (data.items.find((i) => i.kind === "run" && i.sessionId === runId) ??
      (runItem?.sessionId === runId ? runItem : null))
    : null;
  const oknoBiegu =
    kluczBiegu !== null &&
    kluczBiegu !== zamknietyBieg &&
    (newRun !== null || edytowanyBieg !== null);
  function zamknijBieg() {
    setZamknietyBieg(kluczBiegu);
    router.replace(`/sport?miesiac=${month}`, { scroll: false });
  }

  const zaznacz = useCallback((klucz: string | null) => {
    setWybrany(klucz);
    setDodaj(null);
  }, []);
  const dodajWDniu = useCallback((dzien: IsoDate | null) => {
    setDodaj(dzien);
    setWybrany(null);
  }, []);

  // Godzina „teraz” w strefie profilu, w dół do 15 min (nowy trening z przycisku)
  function godzinaTeraz() {
    const teraz = minutesNow(profile.timezone);
    const min = teraz - (teraz % 15);
    return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  }

  // Okno biegu (Task 5) czyta stan z adresu: ?bieg={id} albo ?nowy=bieg&data&godzina
  function otworzBieg(req: RunRequest) {
    setWybrany(null);
    setDodaj(null);
    const adres =
      "sessionId" in req
        ? `/sport?miesiac=${month}&bieg=${req.sessionId}`
        : `/sport?miesiac=${month}&nowy=bieg&data=${req.date}&godzina=${req.start}`;
    router.push(adres, { scroll: false });
  }

  // Trening siłowy (pusty albo z szablonu) → ekran treningu. Akcja jest idempotentna dla szablonu i dnia;
  // blokada chroni pusty trening przed podwójnym kliknięciem.
  const tworzy = useRef(false);
  async function rozpocznijSilownie(input: GymSessionInput) {
    if (tworzy.current) return;
    tworzy.current = true;
    setMenuSilowni(false);
    try {
      const wynik = await createGymSession(input);
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

  // ?nowy=silownia: tworzymy pusty trening raz i zastępujemy adres ekranem treningu
  // (wstecz nie wraca do adresu, który tworzyłby kolejny trening).
  const nowyData = newGym ? (newGym.date ?? today) : null;
  const nowyStart = newGym ? (newGym.start ?? "") : null;
  const obsluzonyNowy = useRef<string | null>(null);
  useEffect(() => {
    if (nowyData === null || nowyStart === null) return;
    const klucz = `${nowyData}|${nowyStart}`;
    if (obsluzonyNowy.current === klucz) return;
    obsluzonyNowy.current = klucz;
    let start = nowyStart;
    if (start === "") {
      const teraz = minutesNow(profile.timezone);
      const min = teraz - (teraz % 15);
      start = `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
    }
    void (async () => {
      let wynik;
      try {
        wynik = await createGymSession({ date: nowyData, start });
      } catch {
        wynik = null;
      }
      if (wynik?.ok && wynik.id) {
        router.replace(`/sport/trening/${wynik.id}`);
      } else {
        toast.error(wynik && !wynik.ok ? wynik.message : BLAD_ZAPISU);
        router.replace(`/sport?miesiac=${month}`);
      }
    })();
  }, [nowyData, nowyStart, profile.timezone, month, router]);

  // Filtr działa na kalendarz i „Ostatnie treningi”
  const widoczne =
    filtr === "all" ? data.items : data.items.filter((i) => i.kind === filtr);
  const ostatnie =
    filtr === "all" ? data.recent : data.recent.filter((i) => i.kind === filtr);
  const wykonaneWMiesiacu = widoczne.filter(
    (i) => !i.planned && i.date.slice(0, 7) === month,
  ).length;

  // Sąsiednie miesiące dla ‹ ›
  const [rok, mies] = month.split("-").map(Number);
  const poprzedni =
    mies === 1
      ? `${rok - 1}-12`
      : `${rok}-${String(mies - 1).padStart(2, "0")}`;
  const nastepny =
    mies === 12
      ? `${rok + 1}-01`
      : `${rok}-${String(mies + 1).padStart(2, "0")}`;

  return (
    <>
      <div
        data-testid="web-sport"
        className="flex min-w-0 flex-col max-[799px]:hidden"
      >
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eaeaea] px-6 py-3">
          <div className="flex items-center gap-2.5">
            <Button asChild size="sm" className="px-2 py-1.5">
              <Link href={`/sport?miesiac=${poprzedni}`} aria-label="Poprzedni">
                ‹
              </Link>
            </Button>
            <Button asChild size="sm" className="px-2.5 py-1.5">
              <Link href={`/sport?miesiac=${today.slice(0, 7)}`}>Dziś</Link>
            </Button>
            <Button asChild size="sm" className="px-2 py-1.5">
              <Link href={`/sport?miesiac=${nastepny}`} aria-label="Następny">
                ›
              </Link>
            </Button>
            <h1 className="m-0 ml-1.5 text-lg font-semibold">Sport</h1>
            <span className="font-mono text-xs text-[#6b6b6b]">
              {`${MIESIACE[mies - 1]} ${rok}`}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segment
              ariaLabel="Aktywność"
              value={filtr}
              onChange={(v) => {
                setFiltr(v);
                setWybrany(null);
                setDodaj(null);
              }}
              options={[
                { value: "all", label: "Wszystko" },
                { value: "run", label: "Bieg" },
                { value: "gym", label: "Siłownia" },
              ]}
            />
            <ActionPopover
              open={menuSilowni}
              onOpenChange={setMenuSilowni}
              align="end"
              width={220}
              trigger={<Button size="sm">+ Trening siłowy</Button>}
            >
              <div className="flex flex-col gap-px">
                <button
                  type="button"
                  className={OPCJA}
                  onClick={() =>
                    void rozpocznijSilownie({
                      date: today,
                      start: godzinaTeraz(),
                    })
                  }
                >
                  Pusty trening
                </button>
                {data.templates.length > 0 && (
                  <>
                    <div className="mt-1 border-t border-[#eaeaea] px-2.5 pt-2 pb-1 font-mono text-[10px] tracking-[0.06em] text-[#6b6b6b] uppercase">
                      Z szablonu
                    </div>
                    {data.templates.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={OPCJA}
                        onClick={() =>
                          void rozpocznijSilownie({
                            date: today,
                            start: t.start_time.slice(0, 5),
                            templateId: t.id,
                          })
                        }
                      >
                        {t.name}
                      </button>
                    ))}
                  </>
                )}
                <div className="my-1 border-t border-[#eaeaea]" />
                <Link
                  href="/sport/szablony"
                  className={OPCJA}
                  onClick={() => setMenuSilowni(false)}
                >
                  Szablony treningów…
                </Link>
              </div>
            </ActionPopover>
            <Button
              variant="primary"
              size="sm"
              onClick={() => otworzBieg({ date: today, start: godzinaTeraz() })}
            >
              Nowy bieg
            </Button>
          </div>
        </header>

        <div className="box-border flex w-full flex-col gap-6 p-6">
          <MonthCalendar
            data={data}
            items={widoczne}
            selectedKey={wybrany}
            addDate={dodaj}
            onSelect={zaznacz}
            onAddDay={dodajWDniu}
            onOpenRun={otworzBieg}
            onStartGym={(input) => void rozpocznijSilownie(input)}
            onDelete={setDoUsuniecia}
            suspended={doUsuniecia !== null}
          />

          <div className="-mt-3 flex flex-wrap gap-4 font-mono text-[11px] text-[#666666]">
            <span>
              <span className="mr-1.5 inline-block size-2.5 rounded-[3px] bg-[#c2410c] align-[-1px]" />
              Bieg
            </span>
            <span>
              <span className="mr-1.5 inline-block size-2.5 rounded-[3px] bg-[#404040] align-[-1px]" />
              Siłownia
            </span>
            <span>
              <span className="mr-1.5 box-border inline-block size-2.5 rounded-[3px] border border-dashed border-[#6b6b6b] align-[-2px]" />
              Zaplanowany, bez danych
            </span>
          </div>

          <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-stretch gap-6">
            <WeekTiles items={data.items} today={today} profile={profile} />
            <RecordCard
              exercises={data.exercises}
              setsHistory={data.setsHistory}
              onNewGym={() =>
                void rozpocznijSilownie({ date: today, start: godzinaTeraz() })
              }
            />
          </div>

          <RecentTable
            items={ostatnie}
            month={month}
            doneInMonth={wykonaneWMiesiacu}
            setsHistory={data.setsHistory}
            onOpenRun={otworzBieg}
          />
        </div>
      </div>

      {oknoBiegu && (
        <RunDialog
          key={kluczBiegu}
          item={edytowanyBieg}
          date={edytowanyBieg ? edytowanyBieg.date : (newRun?.date ?? today)}
          start={
            edytowanyBieg
              ? `${String(Math.floor(edytowanyBieg.startMin / 60)).padStart(2, "0")}:${String(edytowanyBieg.startMin % 60).padStart(2, "0")}`
              : (newRun?.start ?? godzinaTeraz())
          }
          profile={profile}
          onClose={zamknijBieg}
        />
      )}

      {doUsuniecia && (
        <DeleteSessionDialog
          item={doUsuniecia}
          clock={profile.clock}
          onCancel={() => setDoUsuniecia(null)}
          onDeleted={() => {
            setDoUsuniecia(null);
            setWybrany(null);
          }}
        />
      )}
    </>
  );
}
