import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Łączy klasy Tailwinda i usuwa konflikty (standard shadcn/ui)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
