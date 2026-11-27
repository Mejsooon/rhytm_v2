// Pusty stan Sportu dla nowego konta (S2SportEmpty).
import { Activity, Dumbbell, Trophy } from "lucide-react";

import { Button, Card } from "@/components/controls";

const CO_ZOBACZYSZ = [
  { Znak: Dumbbell, tytul: "Treningi i szablony", opis: "Serie, ciężary i przerwy z licznikiem" },
  { Znak: Activity, tytul: "Biegi", opis: "Dystans, czas, tempo, tygodniowy cel km" },
  { Znak: Trophy, tytul: "Rekordy", opis: "Szacowany 1RM i najlepsze czasy liczone same" },
];

export function SportEmpty({ onGym, onRun, onActivity }: { onGym: () => void; onRun: () => void; onActivity: () => void }) {
  return (
    <div className="mx-auto flex w-[520px] max-w-full flex-col gap-[18px] py-12">
      <span aria-hidden="true" className="grid size-10 place-items-center rounded-[10px] bg-black/[.04] text-soft-foreground">
        <Activity size={18} />
      </span>
      <h2 className="m-0 text-xl font-semibold tracking-[-0.015em]">Zacznij od pierwszego treningu</h2>
      <p className="m-0 leading-[1.55] text-muted-foreground">
        Zapisz bieg, trening siłowy albo inną aktywność. Statystyki, rekordy i kalendarz sportu pojawią się po pierwszym wpisie.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={onGym}>
          Rozpocznij trening siłowy
        </Button>
        <Button onClick={onRun}>Zapisz bieg</Button>
        <Button onClick={onActivity}>Inna aktywność</Button>
      </div>
      <Card className="px-4 py-1">
        <div className="pt-2.5 pb-1 text-xs font-medium text-muted-foreground">Co tu zobaczysz</div>
        {CO_ZOBACZYSZ.map(({ Znak, tytul, opis }) => (
          <div key={tytul} className="flex items-center gap-2.5 border-t border-border py-2.5">
            <span aria-hidden="true" className="grid size-7 place-items-center rounded-[9px] bg-black/[.04] text-soft-foreground">
              <Znak size={14} />
            </span>
            <span className="flex-1">
              <b className="font-medium">{tytul}</b>
              <div className="text-xs text-muted-foreground">{opis}</div>
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
}
