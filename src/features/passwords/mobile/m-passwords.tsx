"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Copy, Eye, EyeOff, Lock, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { Avatar, Button, Card, Chip, StatusBadge } from "@/components/controls";
import type { PageField } from "@/features/pages/fields";
import { OptionBadge } from "@/features/pages/table/option-badge";
import type { PageRow } from "@/features/pages/table-model";
import { isSecretValue } from "@/features/vault/crypto";
import { useVault } from "@/features/vault/vault-provider";
import { SCHOWEK_MS } from "@/features/vault/clipboard-timeout";
import { CategoriesPopover } from "../categories-popover";

const MASKA = "••••••••••";

// Rozwinięty wiersz hasła (CMPasswords): hasło i notatka jako zaszyfrowane pola z oczkiem, URL i „Edytuj”.
// Tekst jawny żyje tylko w stanie tego komponentu. Komponent jest montowany dopiero po rozwinięciu wiersza,
// więc zwinięcie (inny wiersz, ten sam wiersz) i odmontowanie widoku go zrzucają. Odszyfrowanie dopiero po
// stuknięciu „Pokaż” albo „Kopiuj hasło” — samo rozwinięcie niczego nie odszyfrowuje.
function SzczegolyHasla({
  wiersz,
  hasloPole,
  notatkaPole,
  urlPole,
  onEdit,
  planClipboardClear,
}: {
  wiersz: PageRow;
  hasloPole: PageField | undefined;
  notatkaPole: PageField | undefined;
  urlPole: PageField | undefined;
  onEdit: () => void;
  planClipboardClear: () => boolean;
}) {
  const vault = useVault();
  const decrypt = vault.decrypt;
  const odblokowany = vault.status === "odblokowany";
  // Odszyfrowany tekst odsłoniętych sekretów (id pola → tekst; false = nie da się odczytać). Brak wpisu = maska.
  const [jawne, setJawne] = React.useState<Record<string, string | false>>({});
  const [skopiowano, setSkopiowano] = React.useState(false);
  // Status widziany po await (po blokadzie nic nie trafia do stanu ani do schowka) i zamontowanie
  const statusRef = React.useRef(vault.status);
  const zamontowany = React.useRef(true);
  React.useEffect(() => {
    statusRef.current = vault.status;
  }, [vault.status]);
  React.useEffect(() => {
    zamontowany.current = true;
    return () => {
      zamontowany.current = false;
    };
  }, []);

  // Aktualne wartości wiersza widziane po await (do porównania szyfrogramu przed ustawieniem tekstu)
  const surowaRef = React.useRef(wiersz.values);
  React.useEffect(() => {
    surowaRef.current = wiersz.values;
  }, [wiersz.values]);

  // Blokada sejfu albo nowy szyfrogram (zapis z arkusza) zrzucają odsłonięty tekst
  const wartoscHasla = hasloPole ? wiersz.values[hasloPole.id] : undefined;
  const wartoscNotatki = notatkaPole ? wiersz.values[notatkaPole.id] : undefined;
  const [poprzednie, setPoprzednie] = React.useState({ status: vault.status, wartoscHasla, wartoscNotatki });
  if (
    poprzednie.status !== vault.status ||
    poprzednie.wartoscHasla !== wartoscHasla ||
    poprzednie.wartoscNotatki !== wartoscNotatki
  ) {
    setPoprzednie({ status: vault.status, wartoscHasla, wartoscNotatki });
    setJawne({});
    if (vault.status !== "odblokowany") setSkopiowano(false);
  }

  // Dopisek „Skopiowano” znika razem z czyszczeniem schowka
  React.useEffect(() => {
    if (!skopiowano) return;
    const timer = setTimeout(() => setSkopiowano(false), SCHOWEK_MS);
    return () => clearTimeout(timer);
  }, [skopiowano]);

  const sekrety = [
    { pole: hasloPole, etykieta: "Hasło", pokaz: "Pokaż hasło", ukryj: "Ukryj hasło", kopiuj: true },
    { pole: notatkaPole, etykieta: "Notatka", pokaz: "Pokaż notatkę", ukryj: "Ukryj notatkę", kopiuj: false },
  ];
  const adresUrl = urlPole ? wiersz.values[urlPole.id] : undefined;
  const url = typeof adresUrl === "string" && adresUrl.trim() !== "" ? adresUrl.trim() : null;
  // Jak w komórce webu: adres bez schematu dostaje https://
  const href = url === null ? null : /^https?:\/\//i.test(url) ? url : `https://${url}`;

  return (
    <div className="flex flex-col gap-2 pr-3.5 pb-3.5 pl-[60px]">
      {sekrety.map(({ pole, etykieta, pokaz, ukryj, kopiuj }) => {
        if (!pole) return null;
        const surowa = wiersz.values[pole.id];
        const pusty = surowa === null || surowa === undefined;
        // Pusta notatka (i pusty URL) są pomijane; puste hasło zostaje, bo to główne pole wiersza
        if (pusty && !kopiuj) return null;
        const tekst = jawne[pole.id];
        const odslonieto = tekst !== undefined;
        return (
          <React.Fragment key={pole.id}>
            <span className="text-xs font-medium text-muted-foreground">{etykieta}</span>
            {/* .igroup bez prawego paddingu: maska albo tekst, oczko i (hasło) kopiowanie, wszystko 44 px */}
            <div className="flex h-11 items-center rounded-md border border-input bg-white pl-[11px] shadow-xs">
              {pusty ? (
                <span className="min-w-0 flex-1 text-faint-foreground">—</span>
              ) : tekst === false || !isSecretValue(surowa) ? (
                <span className="min-w-0 flex-1 truncate text-destructive-foreground">nie da się odczytać</span>
              ) : odslonieto ? (
                // Odsłonięty tekst nie trafia do tłumacza przeglądarki
                <span translate="no" className="notranslate min-w-0 flex-1 truncate tabular-nums text-foreground">
                  {tekst}
                </span>
              ) : (
                <span className="min-w-0 flex-1 truncate tracking-[.02em] tabular-nums text-foreground">{MASKA}</span>
              )}
              <Button
                variant="ghost"
                icon
                aria-label={odslonieto ? ukryj : pokaz}
                disabled={pusty || !odblokowany}
                onClick={async () => {
                  if (odslonieto) {
                    setJawne((m) => {
                      const reszta = { ...m };
                      delete reszta[pole.id];
                      return reszta;
                    });
                    return;
                  }
                  if (!isSecretValue(surowa) || !(await vault.confirmReveal())) return;
                  // Odszyfrowanie lokalne dopiero teraz; tekst trafia tylko do stanu tego komponentu
                  const t = await decrypt(surowa);
                  if (statusRef.current !== "odblokowany" || !zamontowany.current) return;
                  // Szyfrogram zmienił się w trakcie (zapis z arkusza): wynik dotyczy starej wartości, odrzucamy go
                  const aktualna = surowaRef.current[pole.id];
                  if (!isSecretValue(aktualna) || aktualna.ct !== surowa.ct || aktualna.iv !== surowa.iv) return;
                  setJawne((m) => ({ ...m, [pole.id]: t ?? false }));
                }}
                className="text-muted-foreground"
              >
                {odslonieto ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
              </Button>
              {kopiuj && (
                <Button
                  variant="ghost"
                  icon
                  aria-label="Kopiuj hasło"
                  disabled={!isSecretValue(surowa) || !odblokowany}
                  onClick={async () => {
                    if (!isSecretValue(surowa) || !(await vault.confirmReveal())) return;
                    // Odszyfrowanie lokalne; tekst jawny żyje tylko w tej funkcji (nie trafia do stanu)
                    const t = await decrypt(surowa);
                    // Blokada w trakcie odszyfrowywania: nic nie trafia do schowka
                    if (statusRef.current !== "odblokowany") return;
                    if (t === null) {
                      toast.error("Nie udało się skopiować.");
                      return;
                    }
                    try {
                      await navigator.clipboard.writeText(t);
                    } catch {
                      toast.error("Nie udało się skopiować.");
                      return;
                    }
                    // Tabela planuje czyszczenie schowka po 30 s (i czyści od razu, gdy sejf zablokował się w trakcie)
                    if (!planClipboardClear()) return;
                    if (zamontowany.current) setSkopiowano(true);
                  }}
                  className="text-muted-foreground"
                >
                  <Copy aria-hidden="true" size={18} />
                </Button>
              )}
            </div>
          </React.Fragment>
        );
      })}
      {href !== null && (
        <>
          <span className="text-xs font-medium text-muted-foreground">URL</span>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-11 content-center text-sm break-all tabular-nums text-foreground underline underline-offset-2"
          >
            {url}
          </a>
        </>
      )}
      <div className="flex items-center gap-2">
        <span role="status" className="flex-1 text-xs tabular-nums text-success">
          {skopiowano ? "Skopiowano · schowek wyczyści się za 30 s" : ""}
        </span>
        <Button onClick={onEdit}>Edytuj</Button>
      </div>
    </div>
  );
}

// Moduł Hasła na telefonie (CMPasswords.dc.html): nagłówek (Strony, „Zablokuj sejf”, „Nowe hasło”), tytuł,
// plakietka z odliczaniem, wyszukiwarka, chipy Kategorii i lista-akordeon (jedno rozwinięcie naraz).
// Dane i akcje dostaje od PageTable (jeden magazyn z tabelą webu); fraza i Kategoria są stanem widoku modułu,
// a wiersze zawęża już PasswordsView (w `renderPhone`, po jawnych kolumnach). Teksty jawne: tylko w rozwiniętym wierszu (SzczegolyHasla).
export function MPasswords({
  fields,
  rows,
  fraza,
  onFraza,
  kategoriaId,
  onKategoria,
  onNewRow,
  onEditRow,
  onCreateOption,
  onRemoveOption,
  planClipboardClear,
}: {
  fields: PageField[];
  // Wiersze po filtrze (wyszukiwarka i Kategoria)
  rows: PageRow[];
  fraza: string;
  onFraza: (fraza: string) => void;
  kategoriaId: string | null;
  onKategoria: (id: string | null) => void;
  onNewRow: () => void;
  onEditRow: (row: PageRow) => void;
  onCreateOption: (field: PageField, label: string) => Promise<unknown>;
  onRemoveOption: (field: PageField, optionId: string) => Promise<unknown>;
  planClipboardClear: () => boolean;
}) {
  const vault = useVault();
  // Id rozwiniętego wiersza (jedno rozwinięcie naraz)
  const [otwarty, setOtwarty] = React.useState<string | null>(null);
  const baseId = React.useId();

  const tytulowe = fields.find((f) => f.isTitle);
  const loginPole = fields.find((f) => f.name === "Login");
  const hasloPole = fields.find((f) => f.name === "Hasło" && f.type === "secret");
  const notatkaPole = fields.find((f) => f.name === "Notatka" && f.type === "secret");
  const urlPole = fields.find((f) => f.name === "URL" && f.type === "url");
  const kategoriaPole = fields.find((f) => f.name === "Kategoria" && f.type === "select");
  const opcje = kategoriaPole?.config.options ?? [];
  const wybrana = opcje.some((o) => o.id === kategoriaId) ? kategoriaId : null;

  // Pozostały czas do blokady jako m:ss
  const sekundy = Math.max(0, Math.ceil(vault.remainingMs / 1000));
  const odliczanie = `${Math.floor(sekundy / 60)}:${String(sekundy % 60).padStart(2, "0")}`;

  // Zmiana układu (próg 800 px) zwija rozwinięty wiersz, więc odsłonięty tekst nie zostaje w ukrytym układzie
  React.useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const zapytanie = window.matchMedia("(min-width: 800px)");
    if (typeof zapytanie?.addEventListener !== "function") return;
    const zwin = () => setOtwarty(null);
    zapytanie.addEventListener("change", zwin);
    return () => zapytanie.removeEventListener("change", zwin);
  }, []);

  // Rozwinięty wiersz, którego już nie ma na liście (filtr, usunięcie), się zwija
  if (otwarty !== null && !rows.some((r) => r.id === otwarty)) setOtwarty(null);

  const zawezone = fraza.trim() !== "" || wybrana !== null;

  return (
    <div className="flex flex-col">
      <header className="m-head px-2">
        <Button variant="ghost" icon asChild>
          <Link href="/strony" aria-label="Strony">
            <ChevronLeft size={20} aria-hidden="true" />
          </Link>
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          icon
          aria-label="Zablokuj sejf"
          onClick={vault.lock}
          className="text-warning-foreground"
        >
          <Lock size={20} aria-hidden="true" />
        </Button>
        <Button variant="ghost" icon aria-label="Nowe hasło" onClick={onNewRow}>
          <Plus size={20} aria-hidden="true" />
        </Button>
      </header>

      <div className="flex flex-col gap-4 px-4 pt-5 pb-6">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-[-0.011em]">Hasła</h1>
          <div className="mt-2.5">
            <StatusBadge tone="green" size="lg" className="tabular-nums">
              odblokowany · auto-blokada za {odliczanie}
            </StatusBadge>
          </div>
        </div>

        {/* .igroup 44 px: ikona + pole 16 px; szuka po Serwisie i Loginie (sekretów nie przeszukuje) */}
        <label className="flex h-11 items-center gap-2 rounded-md border border-input bg-white px-[11px] text-muted-foreground shadow-xs transition-[box-shadow,border-color] duration-150 focus-within:border-ring focus-within:shadow-halo">
          <Search size={18} aria-hidden="true" className="flex-none" />
          <input
            type="search"
            // Bez atrybutu name; atrybuty data-* wyłączają 1Password, LastPass, Bitwarden i inne menedżery
            // (szukajka nie ma być traktowana jak pole loginu). Samo hasło to tekst w ramce, nigdy pole formularza.
            autoComplete="off"
            data-1p-ignore=""
            data-lpignore="true"
            data-bwignore=""
            data-form-type="other"
            value={fraza}
            onChange={(e) => onFraza(e.target.value)}
            placeholder="Szukaj"
            aria-label="Szukaj haseł"
            className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-base text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>

        {kategoriaPole && (
          <div className="flex min-h-11 items-center gap-2 overflow-x-auto">
            {opcje.length > 0 &&
              [{ id: null as string | null, label: "Wszystkie" }, ...opcje].map((o) => (
                <Chip key={o.id ?? "wszystkie"} selected={wybrana === o.id} onClick={() => onKategoria(o.id)}>
                  {o.label}
                </Chip>
              ))}
            <div className="flex-none">
              <CategoriesPopover
                phone
                options={opcje}
                readOnly={false}
                onCreate={(etykieta) => onCreateOption(kategoriaPole, etykieta)}
                onRemove={(id) => onRemoveOption(kategoriaPole, id)}
              />
            </div>
          </div>
        )}

        {rows.length === 0 ? (
          <p className="m-0 text-center text-[13px] text-muted-foreground">
            {zawezone ? "Nic nie znaleziono." : "Brak haseł. Dodaj pierwsze przyciskiem +."}
          </p>
        ) : (
          <Card className="overflow-hidden">
            {rows.map((wiersz) => {
              const serwisSurowy = tytulowe ? wiersz.values[tytulowe.id] : undefined;
              const serwis = typeof serwisSurowy === "string" && serwisSurowy.trim() !== "" ? serwisSurowy : (tytulowe?.config.empty_label ?? "Bez nazwy");
              const loginSurowy = loginPole ? wiersz.values[loginPole.id] : undefined;
              const login = typeof loginSurowy === "string" ? loginSurowy : "";
              const kategoria = kategoriaPole ? opcje.find((o) => o.id === wiersz.values[kategoriaPole.id]) : undefined;
              const rozwiniety = otwarty === wiersz.id;
              return (
                <div key={wiersz.id} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    aria-expanded={rozwiniety}
                    aria-controls={`${baseId}-${wiersz.id}`}
                    onClick={() => setOtwarty(rozwiniety ? null : wiersz.id)}
                    className="m-row min-h-16 w-full cursor-pointer border-0 bg-transparent px-3.5 text-left font-[inherit] hover:bg-black/[.02]"
                  >
                    <Avatar initials={serwis.charAt(0).toUpperCase()} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{serwis}</span>
                      <span className="block truncate text-[13px] text-muted-foreground tabular-nums">{login}</span>
                    </span>
                    {kategoria && <OptionBadge option={kategoria} />}
                    <ChevronRight
                      size={16}
                      aria-hidden="true"
                      className={`flex-none text-faint-foreground transition-transform duration-150 ${rozwiniety ? "rotate-90" : ""}`}
                    />
                  </button>
                  {/* Kontener zawsze w DOM (cel aria-controls); szczegóły montują się dopiero po rozwinięciu */}
                  <div id={`${baseId}-${wiersz.id}`}>
                    {rozwiniety && (
                      <SzczegolyHasla
                        wiersz={wiersz}
                        hasloPole={hasloPole}
                        notatkaPole={notatkaPole}
                        urlPole={urlPole}
                        onEdit={() => onEditRow(wiersz)}
                        planClipboardClear={planClipboardClear}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
}
