// Pasek siły hasła: 4 segmenty (Register.dc.html). Kolor wypełnionych segmentów zależy od wyniku 0–4.
const KOLORY = ["#e0e0e0", "#b91c1c", "#c2410c", "#15803d", "#15803d"] as const;

export function StrengthBar({ score, className }: { score: 0 | 1 | 2 | 3 | 4; className?: string }) {
  return (
    <div className={`flex gap-1 ${className ?? ""}`} role="img" aria-label={`Siła hasła: ${score} z 4`}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          data-testid="strength-segment"
          className="h-1 flex-1 rounded-[2px]"
          style={{ backgroundColor: i < score ? KOLORY[score] : "#eaeaea" }}
        />
      ))}
    </div>
  );
}
