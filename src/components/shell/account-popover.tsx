"use client";

import * as React from "react";
import { ChevronsUpDown, LogOut, UserRound } from "lucide-react";
import Link from "next/link";

import {
  ActionPopover,
  Avatar,
  MENU_ITEM,
  MENU_ITEM_DANGER,
  MENU_LABEL,
  MENU_SEPARATOR,
} from "@/components/controls";
import { SignOutForm } from "@/features/auth/sign-out-form";
import { cn } from "@/lib/utils";

export type SidebarUser = {
  displayName: string;
  email: string;
  avatarUrl: string | null;
};

// Blok użytkownika na dole sidebara + dymek konta nad nim (CSidebar.dc.html).
// Ustawienia mają własną pozycję w sidebarze, więc w dymku są „Konto” (→ /ustawienia/konto) i „Wyloguj się”.
export function AccountPopover({ user }: { user: SidebarUser }) {
  const [open, setOpen] = React.useState(false);
  // Inicjał: pierwsza litera nazwy, wielka (Array.from — bezpieczne dla znaków poza BMP)
  const inicjal = (
    Array.from(user.displayName.trim())[0] ?? "?"
  ).toLocaleUpperCase("pl");

  return (
    <ActionPopover
      open={open}
      onOpenChange={setOpen}
      side="top"
      // Pełna szerokość stopki sidebara (232 − 2 × 8 px), jak w CSidebar
      width={216}
      className="p-1"
      trigger={
        <button
          type="button"
          aria-haspopup="dialog"
          className={cn(
            "flex w-full cursor-pointer items-center gap-2 rounded-[8px] border-0 px-2 py-1.5 text-left text-sm text-foreground outline-none hover:bg-black/[.04] focus-visible:shadow-focus",
            open ? "bg-black/5 hover:bg-black/5" : "bg-transparent",
          )}
        >
          {user.avatarUrl ? (
            // Zdjęcie w kółku jak .avatar (28 px, wewnętrzna ramka)
            <span className="inline-flex size-7 flex-none overflow-hidden rounded-full bg-muted shadow-[inset_0_0_0_1px_var(--border)]">
              {/* eslint-disable-next-line @next/next/no-img-element -- mały awatar z zewnętrznego URL */}
              <img src={user.avatarUrl} alt="" className="size-full object-cover" />
            </span>
          ) : (
            <Avatar initials={inicjal} className="size-7 text-xs" />
          )}
          <span className="flex min-w-0 flex-1 flex-col leading-[1.3]">
            <span className="font-medium">{user.displayName}</span>
            <span className="truncate text-xs text-muted-foreground">
              {user.email}
            </span>
          </span>
          <ChevronsUpDown size={16} aria-hidden="true" className="flex-none text-muted-foreground" />
        </button>
      }
    >
      {/* Treść jak menu „Konto” w CSidebar: .mi-lbl z nazwą i e-mailem, .mi-sep, „Wyloguj się” (.mi.bad) */}
      <div className="flex flex-col">
        <div className={cn(MENU_LABEL, "px-2 pt-2 pb-1.5")}>
          <div className="text-sm font-medium text-foreground">{user.displayName}</div>
          <div className="truncate font-normal">{user.email}</div>
        </div>
        <div className={MENU_SEPARATOR} />
        {/* „Konto” (.mi): ikona w kolorze muted + tekst, prowadzi do zakładki „Konto i bezpieczeństwo” */}
        <Link
          href="/ustawienia/konto"
          onClick={() => setOpen(false)}
          className={MENU_ITEM}
        >
          <UserRound size={16} aria-hidden="true" className="text-muted-foreground" />
          Konto
        </Link>
        <SignOutForm>
          <button type="submit" className={cn(MENU_ITEM, MENU_ITEM_DANGER)}>
            <LogOut size={16} aria-hidden="true" />
            Wyloguj się
          </button>
        </SignOutForm>
      </div>
    </ActionPopover>
  );
}
