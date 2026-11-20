// Pasek siły hasła: 4 segmenty (Register.dc.html). Kolor wypełnionych segmentów zależy od wyniku 0–4.
const KOLORY = ["#e0e0e0", "#b91c1c", "#c2410c", "#15803d", "#15803d"] as const;

export function StrengthBar({
  score,
  className,
}: {
  score: 0 | 1 | 2 | 3 | 4;
  className?: string;
}) {
  return (
    <div
      className={`flex gap-1 max-[799px]:hidden ${className ?? ""}`}
      role="img"
      aria-label={`Siła hasła: ${score} z 4`}
    >
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

// Wariant telefonu (MRegister.dc.html): własna punktacja (długość, wielka litera, cyfra, znak specjalny),
// 5 kolorów i podpis pod paskiem. Pokazywany tylko poniżej 800 px.
const KOLORY_TELEFON = [
  "#e0e0e0",
  "#b91c1c",
  "#c2410c",
  "#ca8a04",
  "#15803d",
] as const;
const OPISY_TELEFON = [
  "Za krótkie",
  "Słabe",
  "Średnie",
  "Dobre",
  "Mocne",
] as const;

export function PhoneStrengthBar({
  password,
  className,
}: {
  password: string;
  className?: string;
}) {
  const score =
    (password.length >= 10 ? 1 : 0) +
    (/[A-Z]/.test(password) ? 1 : 0) +
    (/[0-9]/.test(password) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(password) ? 1 : 0);
  return (
    <div
      className={`flex flex-col gap-1.5 min-[800px]:hidden ${className ?? ""}`}
    >
      <div className="grid grid-cols-4 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            data-testid="strength-segment-m"
            className="h-1 rounded-[2px]"
            style={{
              backgroundColor: i < score ? KOLORY_TELEFON[score] : "#ececec",
            }}
          />
        ))}
      </div>
      <span
        data-testid="pw-hint"
        className="font-mono text-[11px] font-normal text-muted-foreground"
      >
        {password
          ? `${OPISY_TELEFON[score]} hasło`
          : "10+ znaków, wielka litera, cyfra, znak"}
      </span>
    </div>
  );
}
