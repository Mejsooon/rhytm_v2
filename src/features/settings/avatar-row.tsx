"use client";

import * as React from "react";
import { UploadIcon } from "lucide-react";

import { Button } from "@/components/controls";
import {
  uploadAvatar,
  validateAvatarFile,
} from "@/features/onboarding/avatar-upload";
import { removeAvatar, saveAvatar } from "./actions";

// Wiersz „Zdjęcie profilowe” u góry karty Profil (CSettings.dc.html / MSettings.dc.html).
// Zapis od razu po wyborze pliku — nie dotyka „Zapisz” na dole karty.
export function AvatarRow({
  userId,
  avatarUrl,
  displayName,
}: {
  userId: string;
  avatarUrl: string | null;
  displayName: string;
}) {
  const wejscie = React.useRef<HTMLInputElement>(null);
  // Lokalny podgląd tuż po wgraniu; "usunieto" = zdjęcie z serwera już nieaktualne
  const [podglad, setPodglad] = React.useState<string | null>(null);
  const [usunieto, setUsunieto] = React.useState(false);
  const [pracuje, setPracuje] = React.useState(false);
  const [blad, setBlad] = React.useState("");
  const [zapisano, setZapisano] = React.useState(false);

  // Zwolnienie adresu podglądu przy zamianie na nowy i przy odmontowaniu
  React.useEffect(() => {
    return () => {
      if (podglad) URL.revokeObjectURL(podglad);
    };
  }, [podglad]);

  const zrodlo = usunieto ? podglad : (podglad ?? avatarUrl);
  const maZdjecie = Boolean(zrodlo);
  const inicjal = (Array.from(displayName.trim())[0] ?? "?").toLocaleUpperCase(
    "pl",
  );

  async function wybierzPlik(e: React.ChangeEvent<HTMLInputElement>) {
    const plik = e.target.files?.[0];
    // Pozwala wybrać ten sam plik drugi raz
    e.target.value = "";
    if (!plik || pracuje) return;

    setZapisano(false);
    const komunikat = validateAvatarFile(plik);
    if (komunikat) {
      setBlad(komunikat);
      return;
    }

    setPracuje(true);
    setBlad("");
    try {
      const wgrane = await uploadAvatar(plik, userId);
      if ("error" in wgrane) {
        setBlad(wgrane.error);
        return;
      }
      const wynik = await saveAvatar(wgrane.path);
      if (!wynik.ok) {
        setBlad(wynik.error);
        return;
      }
      setPodglad(URL.createObjectURL(plik));
      setUsunieto(false);
      setZapisano(true);
    } catch {
      setBlad("Nie udało się wgrać zdjęcia.");
    } finally {
      setPracuje(false);
    }
  }

  async function usun() {
    if (pracuje) return;
    setPracuje(true);
    setBlad("");
    setZapisano(false);
    try {
      const wynik = await removeAvatar();
      if (!wynik.ok) {
        setBlad(wynik.error);
        return;
      }
      setPodglad(null);
      setUsunieto(true);
    } catch {
      setBlad("Nie udało się usunąć zdjęcia.");
    } finally {
      setPracuje(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3.5 border-b border-border pb-4 max-[799px]:flex-nowrap max-[799px]:gap-3">
      {zrodlo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={zrodlo}
          alt=""
          className="size-14 flex-none rounded-full object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="box-border flex size-14 flex-none items-center justify-center rounded-full border border-border bg-muted text-xl font-semibold text-foreground"
        >
          {inicjal}
        </span>
      )}
      <span className="min-w-0 flex-[1_1_200px] max-[799px]:flex-1">
        <span className="block font-medium">Zdjęcie profilowe</span>
        {blad ? (
          <span role="alert" className="text-sm text-destructive-foreground">
            {blad}
          </span>
        ) : zapisano ? (
          <span className="text-sm text-success">Zapisano ✓</span>
        ) : (
          <span className="text-sm text-muted-foreground">
            {maZdjecie
              ? "PNG, JPG albo WebP, do 2 MB"
              : "Bez zdjęcia pokażemy inicjały"}
          </span>
        )}
      </span>
      <span className="flex flex-none gap-2">
        {maZdjecie && (
          <Button
            variant="destructive-outline"
            disabled={pracuje}
            onClick={usun}
          >
            Usuń
          </Button>
        )}
        <Button
          disabled={pracuje}
          onClick={() => wejscie.current?.click()}
        >
          <UploadIcon aria-hidden="true" className="size-4" />
          {maZdjecie ? "Zmień" : "Wgraj"}
        </Button>
      </span>
      <input
        ref={wejscie}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        aria-label="Wybierz zdjęcie profilowe"
        onChange={wybierzPlik}
      />
    </div>
  );
}
