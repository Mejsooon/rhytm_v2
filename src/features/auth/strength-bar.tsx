// Pasek siły hasła: 4 segmenty po 6 px na webie i telefonie (CRegister.dc.html, CMRegister.dc.html). Kolor wypełnionych segmentów zależy od wyniku 1–4
// (klasy jako pełne literały, żeby Tailwind je widział); tor to bg-border-soft (rgba(0,0,0,.06)).
// indeks 0 nieużywany (wynik 0 = brak wypełnionych segmentów)
const KOLORY = [
  "",
  "bg-destructive",
  "bg-warning",
  "bg-success",
  "bg-success",
] as const;

export function StrengthBar({
  score,
  className,
}: {
  score: 0 | 1 | 2 | 3 | 4;
  className?: string;
}) {
  return (
    <div
      className={`flex gap-1 ${className ?? ""}`}
      role="img"
      aria-label={`Siła hasła: ${score} z 4`}
    >
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          data-testid="strength-segment"
          className={`h-1.5 flex-1 rounded-full ${i < score ? KOLORY[score] : "bg-border-soft"}`}
        />
      ))}
    </div>
  );
}
