"use client";

// „Szukaj ⌘K” na 404 (S2NotFound)
import { Search } from "lucide-react";

import { Button, Kbd } from "@/components/controls";
import { openSearch } from "./open-search";

export function SearchButton() {
  return (
    <Button onClick={openSearch}>
      <Search size={16} aria-hidden="true" />
      Szukaj <Kbd>⌘K</Kbd>
    </Button>
  );
}
