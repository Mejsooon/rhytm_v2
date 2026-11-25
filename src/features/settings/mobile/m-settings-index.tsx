import { ChevronRight, LogOut } from "lucide-react";
import Link from "next/link";

import { Avatar, Button } from "@/components/controls";
import { ModuleHeader } from "@/components/shell/module-header";
import { SignOutForm } from "@/features/auth/sign-out-form";

import { SETTINGS_TABS } from "../settings-tabs";

// Indeks ustawień na telefonie (CMSettings.dc.html): „Wstecz” → Dziś, tytuł na środku, karta profilu → Ogólne,
// karta z wierszami zakładek, „Wyloguj się” i dopisek wersji. Widoczny tylko poniżej 800 px.
// Pominięte względem makiety: plakietki „Odblokowany” (Sejf) i „wł.” (Powiadomienia) — stan sejfu i push
// zna tylko przeglądarka, a indeks jest renderowany na serwerze; „Motyw” i „Eksport danych” według T9.
export function MSettingsIndex({
  name,
  email,
  avatarUrl,
  version,
}: {
  name: string;
  email: string;
  avatarUrl: string | null;
  version: string;
}) {
  // Inicjał: pierwsza litera nazwy, wielka (Array.from — bezpieczne dla znaków poza BMP)
  const inicjal = (Array.from(name.trim())[0] ?? "?").toLocaleUpperCase("pl");

  return (
    <div className="flex flex-1 flex-col min-[800px]:hidden">
      <ModuleHeader
        title="Ustawienia"
        phoneOnly
        phoneBack={{ href: "/dzis", label: "Wstecz" }}
        phoneCenterTitle
      />
      <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
        {/* Karta profilu → Ogólne */}
        <Link
          href="/ustawienia/ogolne"
          className="flex items-center gap-3.5 rounded-xl border border-border bg-white bg-clip-padding px-6 py-5 text-inherit no-underline shadow-card"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- zdjęcie z podpisanego URL
            <img
              src={avatarUrl}
              alt=""
              className="size-[52px] flex-none rounded-full object-cover"
            />
          ) : (
            <Avatar
              initials={inicjal}
              className="size-[52px] text-xl font-semibold"
            />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[17px] font-semibold">
              {name}
            </span>
            <span className="block truncate text-sm text-muted-foreground">
              {email}
            </span>
          </span>
          <ChevronRight
            aria-hidden="true"
            className="size-4 flex-none text-faint-foreground"
            strokeWidth={2}
          />
        </Link>

        {/* Zakładki: wiersze m-row 56 px z opisem .hint i szewronem */}
        <nav
          aria-label="Sekcje ustawień"
          className="rounded-xl border border-border bg-white bg-clip-padding py-1 shadow-card"
        >
          {SETTINGS_TABS.map((tab) => (
            <Link
              key={tab.slug}
              href={`/ustawienia/${tab.slug}`}
              className="m-row min-h-14"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{tab.label}</span>
                <span className="text-xs text-muted-foreground">
                  {tab.phoneHint}
                </span>
              </span>
              <ChevronRight
                aria-hidden="true"
                className="size-4 flex-none text-faint-foreground"
                strokeWidth={2}
              />
            </Link>
          ))}
        </nav>

        {/* Ta sama akcja co „Wyloguj się” w menu konta (wypisanie z push i signOut) */}
        <SignOutForm>
          <Button
            type="submit"
            variant="destructive-outline"
            className="w-full"
          >
            <LogOut aria-hidden="true" className="size-[18px]" strokeWidth={2} />
            Wyloguj się
          </Button>
        </SignOutForm>

        <div className="text-center text-xs text-muted-foreground tabular-nums">
          rhytm {version}
        </div>
      </div>
    </div>
  );
}
