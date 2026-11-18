"use client";

import * as React from "react";
import { ChevronsUpDown, LogOut } from "lucide-react";

import { ActionPopover } from "@/components/controls";
import { signOut } from "@/features/auth/actions";
import { cn } from "@/lib/utils";

export type SidebarUser = {
  displayName: string;
  email: string;
  avatarUrl: string | null;
};

// Blok użytkownika na dole sidebara + dymek konta nad nim (Sidebar.dc.html).
// Ustawienia mają własną pozycję w sidebarze, więc w dymku jest tylko „Wyloguj się”.
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
      width={212}
      trigger={
        <button
          type="button"
          aria-haspopup="dialog"
          className={cn(
            "flex w-full cursor-pointer items-center gap-2.5 rounded-md border-0 p-2 text-left text-sm text-[#171717] outline-none hover:bg-[#f5f5f5] focus-visible:ring-2 focus-visible:ring-[#171717]/20",
            open ? "bg-[#f0f0f0]" : "bg-transparent",
          )}
        >
          <span className="flex size-[26px] flex-none items-center justify-center overflow-hidden rounded-full border border-[#e0e0e0] bg-[#f0f0f0] text-xs font-medium">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- mały awatar z zewnętrznego URL
              <img
                src={user.avatarUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              inicjal
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="font-medium">{user.displayName}</span>
            <span className="truncate text-xs text-[#666666]">
              {user.email}
            </span>
          </span>
          <ChevronsUpDown size={14} stroke="#666666" aria-hidden="true" />
        </button>
      }
    >
      {/* Popover ma własny padding 10 px, makieta 6 px — wyrównujemy ujemnym marginesem */}
      <div className="-m-1 flex flex-col gap-0.5 text-[13px]">
        <div className="mb-1 border-b border-[#f0f0f0] px-2.5 pt-2 pb-2.5">
          <div className="font-medium">{user.displayName}</div>
          <div className="text-xs text-[#666666]">{user.email}</div>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] font-medium text-[#b91c1c] hover:bg-[#f5f5f5]"
          >
            <LogOut size={15} aria-hidden="true" />
            Wyloguj się
          </button>
        </form>
      </div>
    </ActionPopover>
  );
}
