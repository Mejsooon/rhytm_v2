import { Chip, TextField } from "@/components/controls";
import { SOURCES, type OnboardingDraft } from "../model";
import { StepHeader } from "./step-header";

// Krok 4: skąd o nas usłyszałeś — jeden wybór, klik wybranego odznacza
export function StepSource({
  draft,
  onChange,
}: {
  draft: OnboardingDraft;
  onChange: (next: OnboardingDraft) => void;
}) {
  return (
    <>
      <StepHeader
        title="Skąd o nas usłyszałeś?"
        subtitle="Jedno pytanie, które mówi nam, gdzie warto o rhytm opowiadać. Możesz je pominąć"
      />

      <div role="group" aria-label="Źródło" className="flex flex-wrap gap-2">
        {SOURCES.map((zrodlo) => (
          <Chip
            key={zrodlo.key}
            selected={draft.source === zrodlo.key}
            onClick={() => {
              const source = draft.source === zrodlo.key ? null : zrodlo.key;
              // Pole „Inne” znika razem z wyborem, więc czyścimy też jego treść
              onChange({
                ...draft,
                source,
                sourceOther: source === "other" ? draft.sourceOther : "",
              });
            }}
          >
            {zrodlo.label}
          </Chip>
        ))}
      </div>

      {draft.source === "other" && (
        <TextField
          label="Gdzie dokładnie?"
          value={draft.sourceOther}
          placeholder="Np. podcast, newsletter"
          onChange={(e) => onChange({ ...draft, sourceOther: e.target.value })}
        />
      )}
    </>
  );
}
