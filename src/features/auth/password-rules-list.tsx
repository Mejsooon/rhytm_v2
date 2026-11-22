import { checkPasswordRules } from "@/lib/auth/password-rules";

// Wynik sprawdzenia w bazie wycieków: unknown = jeszcze nie wiadomo (debounce / zapytanie w toku)
export type LeakStatus = "unknown" | "ok" | "leaked";

// Trzy reguły hasła z CRegister.dc.html: kółko 14 px z ramką (niespełniona) albo zielone z ✓ (spełniona).
// Kółko i ✓ są czysto wizualne (aria-hidden); stan dla czytników niesie ukryty tekst „spełnione” / „niespełnione”.
export function PasswordRulesList({
  password,
  leak,
  className,
}: {
  password: string;
  leak: LeakStatus;
  className?: string;
}) {
  const reguly = checkPasswordRules(password);
  const pozycje = [
    { ok: reguly.minLength, tekst: "co najmniej 10 znaków" },
    { ok: reguly.lettersAndDigits, tekst: "litery i cyfry" },
    {
      ok: password.length > 0 && leak === "ok",
      tekst: "nie ma go w bazie wycieków",
    },
  ];
  return (
    <ul
      className={`m-0 flex list-none flex-col gap-1 p-0 text-[13px] font-normal ${className ?? ""}`}
    >
      {pozycje.map((p) => (
        <li
          key={p.tekst}
          className={`flex items-center gap-2 ${p.ok ? "text-success" : "text-muted-foreground"}`}
        >
          <span
            aria-hidden="true"
            className={`inline-grid size-3.5 place-items-center rounded-full text-[9px] font-bold ${p.ok ? "bg-success text-white" : "shadow-[inset_0_0_0_1px_rgba(0,0,0,.18)]"}`}
          >
            {p.ok ? "✓" : ""}
          </span>
          {p.tekst}
          <span className="sr-only">{p.ok ? ": spełnione" : ": niespełnione"}</span>
        </li>
      ))}
    </ul>
  );
}
