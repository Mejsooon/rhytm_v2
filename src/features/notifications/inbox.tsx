"use client";

// Dzwonek i centrum powiadomień wg S2Notifications (tylko web, w pasku bocznym).
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CalendarDays, CircleCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { ActionPopover, Button, StatusBadge } from "@/components/controls";
import { todayIso } from "@/components/controls/calendar-math";
import { cn } from "@/lib/utils";
import { markRead } from "./inbox-actions";

export type InboxItem = {
  id: string;
  kind: "habit" | "block" | "renewal";
  title: string;
  body: string;
  url: string;
  createdAt: string;
  read: boolean;
};

export type Inbox = { items: InboxItem[]; timeZone: string };

// null = nie udało się wczytać (także przekierowanie do logowania zamiast JSON)
const loadInbox = (): Promise<Inbox | null> =>
  fetch("/api/powiadomienia")
    .then((r) => (r.ok ? (r.json() as Promise<Inbox>) : null))
    .catch(() => null);

const IKONY = {
  block: { Ikona: CalendarDays, klasa: "bg-black/[.04] text-foreground" },
  habit: { Ikona: CircleCheck, klasa: "bg-black/[.04] text-foreground" },
  renewal: { Ikona: RefreshCw, klasa: "bg-warning-soft text-warning-foreground" },
};

export function NotificationBell({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [otwarte, setOtwarte] = React.useState(false);
  const [dane, setDane] = React.useState<Inbox | null>(null);
  const [blad, setBlad] = React.useState(false);
  const [tylkoNowe, setTylkoNowe] = React.useState(false);

  const wczytaj = React.useCallback(async () => {
    const wynik = await loadInbox();
    setBlad(!wynik);
    if (wynik) setDane(wynik);
  }, []);

  // Przy wejściu i po powrocie do karty przeglądarki (kropka na dzwonku)
  React.useEffect(() => {
    // Telefon nie ma dzwonka, więc nie pyta serwera
    if (window.matchMedia?.("(max-width: 799px)").matches) return;
    const odswiez = () => {
      if (document.visibilityState === "visible") void wczytaj();
    };
    odswiez();
    document.addEventListener("visibilitychange", odswiez);
    return () => document.removeEventListener("visibilitychange", odswiez);
  }, [wczytaj]);

  const wszystkie = dane?.items ?? [];
  const nieprzeczytane = wszystkie.filter((w) => !w.read);
  const widoczne = tylkoNowe ? nieprzeczytane : wszystkie;
  const strefa = dane?.timeZone ?? "Europe/Warsaw";

  const dzien = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: strefa, year: "numeric", month: "2-digit", day: "2-digit" }).format(
      new Date(iso),
    );
  const dzis = todayIso(strefa);
  const kiedy = (iso: string) => {
    const dni = Math.round((Date.parse(dzis) - Date.parse(dzien(iso))) / 86_400_000);
    const format: Intl.DateTimeFormatOptions =
      dni === 0 ? { hour: "2-digit", minute: "2-digit" } : dni < 7 ? { weekday: "short" } : { day: "2-digit", month: "2-digit" };
    return new Intl.DateTimeFormat("pl-PL", { timeZone: strefa, ...format }).format(new Date(iso));
  };
  const grupy = [
    ["Dziś", widoczne.filter((w) => dzien(w.createdAt) === dzis)] as const,
    ["Wcześniej", widoczne.filter((w) => dzien(w.createdAt) !== dzis)] as const,
  ].filter(([, lista]) => lista.length > 0);

  // Od razu na ekranie; przy błędzie wracamy do stanu z serwera
  async function oznacz(ids: string[]) {
    if (ids.length === 0) return;
    setDane((d) => d && { ...d, items: d.items.map((w) => (ids.includes(w.id) ? { ...w, read: true } : w)) });
    const wynik = await markRead(ids).catch(() => null);
    if (wynik?.ok) return;
    toast.error("Nie udało się zapisać. Spróbuj ponownie.");
    await wczytaj();
  }

  function otworz(w: InboxItem) {
    setOtwarte(false);
    if (!w.read) void oznacz([w.id]);
    // Tylko adresy wewnętrzne aplikacji
    if (w.url.startsWith("/") && !w.url.startsWith("//")) router.push(w.url);
  }

  const ile = nieprzeczytane.length;
  const nazwa = ile > 0 ? `Powiadomienia, ${ile} nieprzeczytane` : "Powiadomienia";

  return (
    <ActionPopover
      open={otwarte}
      onOpenChange={(o) => {
        setOtwarte(o);
        if (o) void wczytaj();
      }}
      width={380}
      ariaLabel="Powiadomienia"
      className="flex max-h-[min(560px,80vh)] flex-col overflow-hidden p-0"
      trigger={
        <button
          type="button"
          aria-label={nazwa}
          title="Powiadomienia"
          className={cn(
            "relative grid flex-none cursor-pointer place-items-center rounded-[8px] border-0 p-0 outline-none focus-visible:shadow-focus",
            compact ? "size-9" : "size-6",
            otwarte
              ? "bg-black/[.06] text-foreground"
              : "bg-transparent text-muted-foreground hover:bg-black/[.04] hover:text-foreground",
          )}
        >
          <Bell size={16} aria-hidden="true" />
          {ile > 0 && (
            <span
              aria-hidden="true"
              className={cn("absolute size-1.5 rounded-full bg-destructive", compact ? "top-2 right-2" : "top-0.5 right-0.5")}
            />
          )}
        </button>
      }
    >
      <header className="flex flex-none items-center justify-between gap-2 px-4 pt-3">
        <h2 className="m-0 text-sm font-semibold">Powiadomienia</h2>
        <Button variant="ghost" size="xs" disabled={ile === 0} onClick={() => void oznacz(nieprzeczytane.map((w) => w.id))}>
          Oznacz wszystkie jako przeczytane
        </Button>
      </header>
      <div role="group" aria-label="Filtr powiadomień" className="flex flex-none gap-1 border-b border-border px-3 py-2">
        {[false, true].map((nowe) => (
          <button
            key={String(nowe)}
            type="button"
            aria-pressed={tylkoNowe === nowe}
            onClick={() => setTylkoNowe(nowe)}
            className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border-0 bg-transparent px-2.5 text-[13px] font-medium text-muted-foreground outline-none focus-visible:shadow-focus aria-pressed:bg-black/[.06] aria-pressed:text-foreground"
          >
            {nowe ? "Nieprzeczytane" : "Wszystkie"}
            {nowe && <StatusBadge tone="gray">{ile}</StatusBadge>}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {grupy.map(([grupa, lista]) => (
          <React.Fragment key={grupa}>
            <div className="px-4 pt-3 pb-1.5 text-xs font-medium text-muted-foreground">{grupa}</div>
            {lista.map((w) => {
              const { Ikona, klasa } = IKONY[w.kind];
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => otworz(w)}
                  className="flex w-full cursor-pointer gap-3 border-0 border-t border-border-soft bg-transparent px-4 py-3 text-left text-sm text-foreground outline-none hover:bg-panel focus-visible:bg-panel"
                >
                  <span aria-hidden="true" className={cn("grid size-8 flex-none place-items-center rounded-[8px]", klasa)}>
                    <Ikona size={16} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={w.read ? "font-medium" : "font-semibold"}>{w.title}</span>
                    <span className="text-xs text-muted-foreground">{w.body}</span>
                  </span>
                  <span className="flex flex-none flex-col items-end gap-1.5">
                    <span className="text-xs text-muted-foreground tabular-nums">{kiedy(w.createdAt)}</span>
                    {!w.read && <span role="img" aria-label="nieprzeczytane" className="size-2 rounded-full bg-info-foreground" />}
                  </span>
                </button>
              );
            })}
          </React.Fragment>
        ))}
        {grupy.length === 0 &&
          (dane ? (
            <div className="flex flex-col items-center gap-1 px-6 py-8 text-center">
              <b className="font-medium">
                {wszystkie.length > 0 ? "Wszystko przeczytane" : "Nie masz jeszcze powiadomień"}
              </b>
              <span className="text-xs text-muted-foreground">
                {wszystkie.length > 0
                  ? "Nowe przypomnienia o blokach, nawykach i odnowieniach pojawią się tutaj."
                  : "Tu zobaczysz przypomnienia o blokach, nawykach i odnowieniach subskrypcji."}
              </span>
            </div>
          ) : (
            <p className="m-0 px-4 py-6 text-center text-muted-foreground">
              {blad ? "Nie udało się wczytać powiadomień." : "Wczytywanie…"}
            </p>
          ))}
      </div>
      <footer className="flex flex-none items-center justify-between gap-2 border-t border-border bg-black/[.025] px-4 py-2">
        <span className="text-xs text-muted-foreground">Starsze niż 30 dni znikają same.</span>
        <Button asChild variant="ghost" size="xs">
          <Link href="/ustawienia/powiadomienia" onClick={() => setOtwarte(false)}>
            Ustawienia powiadomień
          </Link>
        </Button>
      </footer>
    </ActionPopover>
  );
}
