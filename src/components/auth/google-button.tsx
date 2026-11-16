import { Button } from "@/components/controls/button";
import { cn } from "@/lib/utils";

// Przycisk Google — submit własnego <form action={signInWithGoogle}> (osobnego od formularza hasła).
// Etykieta i ikona zależą od szerokości (web / telefon) — tylko CSS.
export function GoogleButton({ className, webLabel = "Zaloguj się przez Google" }: { className?: string; webLabel?: string }) {
  return (
    <Button
      type="submit"
      className={cn("w-full min-h-10 gap-2.5 leading-[1.21] max-[799px]:text-[15px]", className)}
    >
      {/* Web: kolorowe „G” z Login.dc.html */}
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" className="max-[799px]:hidden">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      <span className="max-[799px]:hidden">{webLabel}</span>
      {/* Telefon: „G” z MLogin.dc.html */}
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="min-[800px]:hidden">
          <path fill="#4285F4" d="M22 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.6a4.8 4.8 0 0 1-2.1 3.1v2.6h3.4c2-1.8 3.1-4.5 3.1-7.6Z" />
          <path fill="#34A853" d="M12 22c2.8 0 5.2-.9 6.9-2.5l-3.4-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.7v2.7A10 10 0 0 0 12 22Z" />
          <path fill="#FBBC05" d="M6.2 13.6a6 6 0 0 1 0-3.8V7.1H2.7a10 10 0 0 0 0 9.2l3.5-2.7Z" />
          <path fill="#EA4335" d="M12 5.9c1.5 0 2.9.5 4 1.5l3-3A10 10 0 0 0 2.7 7.1l3.5 2.7C7 7.7 9.3 5.9 12 5.9Z" />
      </svg>
      <span className="min-[800px]:hidden">Kontynuuj z Google</span>
    </Button>
  );
}
