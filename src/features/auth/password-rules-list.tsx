import { checkPasswordRules } from "@/lib/auth/password-rules";

// Wynik sprawdzenia w bazie wycieków: unknown = jeszcze nie wiadomo (debounce / zapytanie w toku)
export type LeakStatus = "unknown" | "ok" | "leaked";

// Trzy reguły hasła z Register.dc.html: ○ #6b6b6b (niespełniona), ✓ #15803d (spełniona)
export function PasswordRulesList({ password, leak, className }: { password: string; leak: LeakStatus; className?: string }) {
  const reguly = checkPasswordRules(password);
  const pozycje = [
    { ok: reguly.minLength, tekst: "co najmniej 10 znaków" },
    { ok: reguly.lettersAndDigits, tekst: "litery i cyfry" },
    { ok: password.length > 0 && leak === "ok", tekst: "nie ma go w bazie wycieków" },
  ];
  return (
    <ul className={`m-0 flex list-none flex-col gap-1 p-0 font-mono text-xs ${className ?? ""}`}>
      {pozycje.map((p) => (
        <li key={p.tekst} style={{ color: p.ok ? "#15803d" : "#6b6b6b" }}>
          {p.ok ? "✓" : "○"} {p.tekst}
        </li>
      ))}
    </ul>
  );
}
