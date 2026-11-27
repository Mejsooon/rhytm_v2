"use client";

// Ekran „Sport” na komputerze (CSport.dc.html): .topbar z akcjami, wiersz ‹ Dziś › z filtrem .seg,
// kalendarz miesiąca z „Σ tydz.”, legenda, kafelki z wykresem, karta rekordu i ostatnie treningi.
// Telefon: MSport (drzewo obok webu, przełącza je wyłącznie CSS 800 px) i arkusz biegu MRunNew.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import {
  ActionPopover,
  Button,
  MENU_ITEM,
  Segment,
} from "@/components/controls";
import { MIESIACE, type IsoDate } from "@/components/controls/calendar-math";
import { ModuleHeader } from "@/components/shell/module-header";
import { minutesNow } from "@/features/calendar/load-calendar";
import { createGymSession, type GymSessionInput } from "./actions";
import { ActivityDialog } from "./activity-dialog";
import { SportOverview } from "./overview";
import { SportEmpty } from "./sport-empty";
import { stats } from "./overview-model";
import { DeleteSessionDialog } from "./delete-session-dialog";
import { MRunNew } from "./mobile/m-run-new";
import { MSport } from "./mobile/m-sport";
import type { RunRequest } from "./item-popover";
import { cn } from "@/lib/utils";
import type { SportMonthData } from "./load-sport";
import { plPlural, type SportItem } from "./model";
import { BIEG, MonthCalendar, SILA } from "./month-calendar";
import { RunDialog } from "./run-dialog";

type Filtr = "all" | "run" | "gym" | "other";

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";

export function SportView({
  data,
  selectedKey,
  newGym,
  runId = null,
  newRun = null,
  runItem = null,
  all,
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
  // Wszystkie sesje (przegląd); bez nich przegląd liczy z danych miesiąca
  all?: SportItem[];
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
  // Wariant okna (arkusz telefonu czy okno web) wybiera matchMedia — w efekcie, po hydratacji, osobno
  // dla każdego adresu okna; do tego czasu okno jest zamknięte. Montowany jest tylko jeden wariant.
  const [wariantBiegu, setWariantBiegu] = useState<{
    klucz: string;
    tel: boolean;
  } | null>(null);
  useEffect(() => {
    if (kluczBiegu === null) return;
    const tel =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 799px)").matches;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- wariant okna jest reakcją na adres i szerokość ekranu
    setWariantBiegu({ klucz: kluczBiegu, tel });
  }, [kluczBiegu]);
  const oknoBiegu =
    kluczBiegu !== null &&
    kluczBiegu !== zamknietyBieg &&
    wariantBiegu?.klucz === kluczBiegu &&
    (newRun !== null || edytowanyBieg !== null);
  const biegNaTelefonie = oknoBiegu && wariantBiegu.tel;
  // Data i godzina okna biegu (RunDialog i MRunNew): edycja — z biegu, nowy — z adresu albo dziś / teraz
  const dataBiegu = edytowanyBieg
    ? edytowanyBieg.date
    : (newRun?.date ?? today);
  const startBiegu = edytowanyBieg
    ? `${String(Math.floor(edytowanyBieg.startMin / 60)).padStart(2, "0")}:${String(edytowanyBieg.startMin % 60).padStart(2, "0")}`
    : (newRun?.start ?? godzinaTeraz());
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

  // `?wybrany=` na telefonie (MSport przekazuje trening raz): bieg → arkusz biegu (?bieg=), trening siłowy →
  // jego ekran, wystąpienie szablonu → rozpoczęcie w jego dniu. Każdy wariant zastępuje adres, więc `wybrany`
  // znika z niego, a wstecz nie wraca do adresu, który otworzyłby trening znowu. Blokujemy też czyszczenie
  // adresu przez efekt webu (inaczej ścigałby się z tym przejściem).
  function otworzWybranyNaTelefonie(item: SportItem) {
    wyczyszczonyKlucz.current = item.key;
    setWybrany(null);
    if (item.kind === "run" && item.sessionId) {
      router.replace(`/sport?miesiac=${month}&bieg=${item.sessionId}`, {
        scroll: false,
      });
    } else if (item.sessionId) {
      router.replace(`/sport/trening/${item.sessionId}`);
    } else {
      router.replace(`/sport?miesiac=${month}`, { scroll: false });
      void rozpocznijSilownie({
        date: item.date,
        start: `${String(Math.floor(item.startMin / 60)).padStart(2, "0")}:${String(item.startMin % 60).padStart(2, "0")}`,
        templateId: item.templateId ?? undefined,
      });
    }
  }

  // ?nowy=silownia: tworzymy pusty trening raz i zastępujemy adres ekranem treningu
  // (wstecz nie wraca do adresu, który tworzyłby kolejny trening). Ref zeruje się, gdy parametry
  // znikną z adresu — Next 16 Activity trzyma ekran w pamięci, a ten sam slot z kalendarza ma zadziałać znowu.
  const nowyData = newGym ? (newGym.date ?? today) : null;
  const nowyStart = newGym ? (newGym.start ?? "") : null;
  const obsluzonyNowy = useRef<string | null>(null);
  useEffect(() => {
    if (nowyData === null || nowyStart === null) {
      obsluzonyNowy.current = null;
      return;
    }
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

  // Okno innej aktywności: undefined = zamknięte, null = nowa (w dniu z kalendarza albo dziś)
  const [dzienAktywnosci, setDzienAktywnosci] = useState<IsoDate | null>(null);
  const [aktywnosc, setAktywnosc] = useState<SportItem | null | undefined>(undefined);
  const godzinaAktywnosci = (i: SportItem | null | undefined) =>
    i ? `${String(Math.floor(i.startMin / 60)).padStart(2, "0")}:${String(i.startMin % 60).padStart(2, "0")}` : null;

  // Filtr działa na kalendarz i „Ostatnie treningi”
  const widoczne =
    filtr === "all" ? data.items : data.items.filter((i) => i.kind === filtr);
  // Przegląd: wszystkie sesje plus wystąpienia szablonów (te nie mają jeszcze sesji)
  const wszystkie = [
    ...(all ?? [...new Map([...data.items, ...data.recent].map((i) => [i.key, i])).values()].filter((i) => i.sessionId !== null)),
    ...data.items.filter((i) => i.sessionId === null),
  ];
  // ?wybrany= prowadzi do dymka w kalendarzu
  const [zakladka, setZakladka] = useState<"przeglad" | "kalendarz">(selectedKey ? "kalendarz" : "przeglad");
  const wMiesiacu = stats(wszystkie.filter((i) => i.date.slice(0, 7) === today.slice(0, 7)));
  const dzisPlan = wszystkie.find((i) => i.planned && i.date === today);
  const podtytul = [
    `${MIESIACE[Number(today.slice(5, 7)) - 1]}: ${wMiesiacu.km.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} km biegu`,
    plPlural(wMiesiacu.runs, "bieg", "biegi", "biegów"),
    plPlural(wMiesiacu.gym, "trening siłowy", "treningi siłowe", "treningów siłowych"),
    ...(wMiesiacu.other ? [plPlural(wMiesiacu.other, "inna aktywność", "inne aktywności", "innych aktywności")] : []),
    ...(dzisPlan ? [`dziś w planie ${dzisPlan.title}`] : []),
  ].join(" · ");

  // Nowe konto: nic nie zapisane i żadnego szablonu w planie
  const pusto = wszystkie.length === 0 && data.templates.length === 0;

  function otworzZPrzegladu(item: SportItem) {
    const start = `${String(Math.floor(item.startMin / 60)).padStart(2, "0")}:${String(item.startMin % 60).padStart(2, "0")}`;
    if (item.kind === "other") setAktywnosc(item);
    else if (item.kind === "run" && item.sessionId) otworzBieg({ sessionId: item.sessionId });
    else if (item.sessionId) router.push(`/sport/trening/${item.sessionId}`);
    else void rozpocznijSilownie({ date: item.date, start, templateId: item.templateId ?? undefined });
  }

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
        data-testid="m-sport"
        className="flex min-w-0 flex-col min-[800px]:hidden"
      >
        <MSport
          data={data}
          selectedKey={selectedKey}
          onNewRun={() => otworzBieg({ date: today, start: godzinaTeraz() })}
          onNewGym={(templateId) => {
            // Jak w dymku „+ Trening siłowy”: szablon startuje o swojej godzinie, pusty — teraz
            const szablon = data.templates.find((t) => t.id === templateId);
            void rozpocznijSilownie(
              szablon
                ? {
                    date: today,
                    start: szablon.start_time.slice(0, 5),
                    templateId: szablon.id,
                  }
                : { date: today, start: godzinaTeraz() },
            );
          }}
          onOpenRun={otworzBieg}
          onStartGym={(input) => void rozpocznijSilownie(input)}
          onSelected={otworzWybranyNaTelefonie}
        />
      </div>
      <div
        data-testid="web-sport"
        className="flex min-w-0 flex-col max-[799px]:hidden"
      >
        {/* .topbar z CSport: tytuł modułu i akcje (.btn, .btn, .btnp — 32 px) */}
        <ModuleHeader
          title="Sport"
          webOnly
          webAction={
            <>
              <Button asChild>
                <Link href="/sport/szablony">Szablony</Link>
              </Button>
              <ActionPopover
                open={menuSilowni}
                onOpenChange={setMenuSilowni}
                align="end"
                width={260}
                className="p-1"
                trigger={<Button variant="primary">Dodaj aktywność</Button>}
              >
                <div className="flex flex-col p-0.5">
                  {(
                    [
                      ["Bieg", "dystans, czas, tempo", "B", "bg-[rgba(245,158,11,.14)] text-[#b45309]", () => otworzBieg({ date: today, start: godzinaTeraz() })],
                      ["Trening siłowy", "pusty albo z szablonu:", "S", "bg-black/[.06] text-soft-foreground", () => void rozpocznijSilownie({ date: today, start: godzinaTeraz() })],
                    ] as const
                  ).map(([nazwa, opis, znak, kolor, akcja]) => (
                    <button
                      key={nazwa}
                      type="button"
                      aria-label={nazwa}
                      className={cn(MENU_ITEM, "h-auto gap-2.5 py-1.5")}
                      onClick={() => {
                        setMenuSilowni(false);
                        akcja();
                      }}
                    >
                      <span aria-hidden="true" className={cn("grid size-7 flex-none place-items-center rounded-[8px] text-xs font-semibold", kolor)}>
                        {znak}
                      </span>
                      <span className="flex flex-col text-left">
                        <span className="font-medium">{nazwa}</span>
                        <span className="text-xs text-muted-foreground">{opis}</span>
                      </span>
                    </button>
                  ))}
                  <div className="flex flex-wrap gap-1.5 py-1 pr-2 pl-[46px]">
                    {[...data.templates, null].map((t) => (
                      <button
                        key={t?.id ?? "pusty"}
                        type="button"
                        onClick={() => {
                          setMenuSilowni(false);
                          void rozpocznijSilownie(
                            t ? { date: today, start: t.start_time.slice(0, 5), templateId: t.id } : { date: today, start: godzinaTeraz() },
                          );
                        }}
                        className="h-7 cursor-pointer rounded-full border border-input bg-white px-2.5 text-xs font-medium outline-none hover:bg-accent focus-visible:shadow-focus"
                      >
                        {t?.name ?? "Pusty"}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    aria-label="Inna aktywność"
                    className={cn(MENU_ITEM, "h-auto gap-2.5 py-1.5")}
                    onClick={() => {
                      setMenuSilowni(false);
                      setAktywnosc(null);
                    }}
                  >
                    <span aria-hidden="true" className="grid size-7 flex-none place-items-center rounded-[8px] bg-[#7c3aed1a] text-xs font-semibold text-[#6d28d9]">
                      I
                    </span>
                    <span className="flex flex-col text-left">
                      <span className="font-medium">Inna aktywność</span>
                      <span className="text-xs text-muted-foreground">tenis, rower, joga, pole dance…</span>
                    </span>
                  </button>
                </div>
              </ActionPopover>
            </>
          }
        />

        <div className="box-border flex w-full flex-col gap-5 px-6 pt-5 pb-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-2xl font-semibold tracking-[-0.02em]">Sport</div>
              <p className="m-0 mt-1 text-muted-foreground">{podtytul}</p>
            </div>
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
                { value: "other", label: "Inne" },
              ]}
            />
          </div>
          <div role="tablist" aria-label="Widok sportu" className="flex gap-5 border-b border-border">
            {([["przeglad", "Przegląd"], ["kalendarz", "Kalendarz"]] as const).map(([klucz, nazwa]) => (
              <button
                key={klucz}
                type="button"
                role="tab"
                aria-selected={zakladka === klucz}
                onClick={() => {
                  if (zakladka === klucz) return;
                  setZakladka(klucz);
                  setWybrany(null);
                  setDodaj(null);
                }}
                className="-mb-px cursor-pointer border-0 border-b-2 border-solid border-transparent bg-transparent px-0 pb-2 text-sm font-medium text-muted-foreground outline-none focus-visible:shadow-focus aria-selected:border-primary aria-selected:text-foreground"
              >
                {nazwa}
              </button>
            ))}
          </div>

          {pusto && (
            <SportEmpty
              onGym={() => void rozpocznijSilownie({ date: today, start: godzinaTeraz() })}
              onRun={() => otworzBieg({ date: today, start: godzinaTeraz() })}
              onActivity={() => setAktywnosc(null)}
            />
          )}

          {!pusto && zakladka === "przeglad" && (
            <SportOverview
              items={wszystkie}
              filtr={filtr}
              today={today}
              initialDate={month === today.slice(0, 7) ? today : `${month}-01`}
              profile={profile}
              exercises={data.exercises}
              setsHistory={data.setsHistory}
              templates={data.templates}
              onOpen={otworzZPrzegladu}
              onDelete={setDoUsuniecia}
              onResetFilter={() => setFiltr("all")}
            />
          )}

          {!pusto && zakladka === "kalendarz" && (
            <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="inline-flex">
                <Button
                  asChild
                  icon
                  className="rounded-r-none focus-visible:z-10"
                >
                  <Link
                    href={`/sport?miesiac=${poprzedni}`}
                    aria-label="Poprzedni"
                  >
                    <ChevronLeft size={16} aria-hidden="true" />
                  </Link>
                </Button>
                <Button
                  asChild
                  className="-ml-px rounded-none focus-visible:z-10"
                >
                  <Link href={`/sport?miesiac=${today.slice(0, 7)}`}>Dziś</Link>
                </Button>
                <Button
                  asChild
                  icon
                  className="-ml-px rounded-l-none focus-visible:z-10"
                >
                  <Link
                    href={`/sport?miesiac=${nastepny}`}
                    aria-label="Następny"
                  >
                    <ChevronRight size={16} aria-hidden="true" />
                  </Link>
                </Button>
              </div>
              <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                {`${MIESIACE[mies - 1]} ${rok}`}
              </span>
            </div>
          </div>

          <MonthCalendar
            data={data}
            items={widoczne}
            selectedKey={wybrany}
            onOpenActivity={(item, dzien) => {
              setWybrany(null);
              setDodaj(null);
              setDzienAktywnosci(dzien);
              setAktywnosc(item);
            }}
            addDate={dodaj}
            onSelect={zaznacz}
            onAddDay={dodajWDniu}
            onOpenRun={otworzBieg}
            onStartGym={(input) => void rozpocznijSilownie(input)}
            onDelete={setDoUsuniecia}
            suspended={doUsuniecia !== null}
          />

          {/* Legenda z makiety: kropki 8 px w kolorach danych (te same stałe co chipy kalendarza) */}
          <div className="-mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ background: BIEG }}
              />
              Bieg
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ background: SILA }}
              />
              Siłownia
            </span>
            {[...new Map(data.items.filter((i) => i.kind === "other").map((i) => [i.title, i.color])).entries()].map(([nazwa, kolor]) => (
              <span key={nazwa} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: kolor }} />
                {nazwa}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="box-border h-2.5 w-3 rounded-[3px] border border-dashed border-muted-foreground" />
              Zaplanowany, bez danych
            </span>
          </div>
            </>
          )}
        </div>
      </div>

      {oknoBiegu && !biegNaTelefonie && (
        <RunDialog
          key={kluczBiegu}
          item={edytowanyBieg}
          date={dataBiegu}
          start={startBiegu}
          profile={profile}
          onClose={zamknijBieg}
        />
      )}
      {biegNaTelefonie && (
        <MRunNew
          key={kluczBiegu}
          item={edytowanyBieg}
          date={dataBiegu}
          start={startBiegu}
          today={today}
          profile={profile}
          onClose={zamknijBieg}
        />
      )}

      {aktywnosc !== undefined && (
        <ActivityDialog
          key={aktywnosc?.key ?? "nowa"}
          item={aktywnosc}
          date={aktywnosc?.date ?? dzienAktywnosci ?? today}
          start={godzinaAktywnosci(aktywnosc) ?? godzinaTeraz()}
          profile={profile}
          kinds={data.activityKinds ?? []}
          onDelete={(item) => {
            setAktywnosc(undefined);
            setDoUsuniecia(item);
          }}
          onClose={() => {
            setAktywnosc(undefined);
            setDzienAktywnosci(null);
          }}
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
