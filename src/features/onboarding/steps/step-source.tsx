import { Chip, TextField } from "@/components/controls";
import { cn } from "@/lib/utils";
import { SOURCES, type OnboardingDraft } from "../model";
import { StepHeader } from "./step-header";

// Ikony 16 px z makiety COnboardingSource (obrys muted, grubość 2)
const IKONY: Record<string, React.ReactNode> = {
  friend: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 14c2.8 0 5 2.2 5 5" />
    </>
  ),
  uni: (
    <>
      <path d="M2 9l10-5 10 5-10 5z" />
      <path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
    </>
  ),
  tiktok: (
    <>
      <path d="M14 3v12a4 4 0 1 1-4-4" />
      <path d="M14 3c0 3 2 5 5 5" />
    </>
  ),
  insta: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" />
    </>
  ),
  yt: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="4" />
      <path d="m10 9 5 3-5 3z" />
    </>
  ),
  x: <path d="M4 4l16 16M20 4 4 20" />,
  reddit: (
    <>
      <circle cx="12" cy="14" r="7" />
      <circle cx="9.5" cy="13" r="0.8" />
      <circle cx="14.5" cy="13" r="0.8" />
      <path d="M9.5 16.5c1.5 1 3.5 1 5 0" />
      <path d="M12 7l1-4 4 1" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  ai: (
    <>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      <rect x="7" y="7" width="10" height="10" rx="2" />
    </>
  ),
  other: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
};

// Krok 4: skąd o nas usłyszałeś — jeden wybór, klik wybranego odznacza.
// Web: karty 2 kol. 44 px z ikonami; telefon (CMOnboarding): chipy 36 px.
export function StepSource({
  draft,
  onChange,
}: {
  draft: OnboardingDraft;
  onChange: (next: OnboardingDraft) => void;
}) {
  function wybierz(key: (typeof SOURCES)[number]["key"]) {
    const source = draft.source === key ? null : key;
    // Pole „Inne” znika razem z wyborem, więc czyścimy też jego treść
    onChange({
      ...draft,
      source,
      sourceOther: source === "other" ? draft.sourceOther : "",
    });
  }

  return (
    <>
      <StepHeader
        title="Skąd o nas usłyszałeś?"
        subtitle="Jedno pytanie, które mówi nam, gdzie warto o rhytm opowiadać. Możesz je pominąć"
      />

      <div
        data-testid="source-web"
        role="group"
        aria-label="Źródło"
        className="grid grid-cols-2 gap-2 max-[799px]:hidden"
      >
        {SOURCES.map((zrodlo) => {
          const wlaczone = draft.source === zrodlo.key;
          return (
            <button
              key={zrodlo.key}
              type="button"
              aria-pressed={wlaczone}
              onClick={() => wybierz(zrodlo.key)}
              className={cn(
                "box-border flex h-11 w-full cursor-pointer items-center gap-3 rounded-lg border border-border bg-white bg-clip-padding px-3.5 text-left text-foreground shadow-xs transition-[border-color,background-color,box-shadow] duration-150 outline-none hover:bg-panel focus-visible:shadow-focus",
                wlaczone &&
                  "border-black/[.24] bg-black/[.025] shadow-[0_0_0_1px_rgba(0,0,0,.12)] hover:bg-black/[.025]",
              )}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="flex-none text-muted-foreground"
              >
                {IKONY[zrodlo.key]}
              </svg>
              <span className="font-medium">{zrodlo.label}</span>
            </button>
          );
        })}
      </div>

      <div
        data-testid="source-phone"
        role="group"
        aria-label="Źródło"
        className="flex flex-wrap gap-2 min-[800px]:hidden"
      >
        {SOURCES.map((zrodlo) => (
          <Chip
            key={zrodlo.key}
            selected={draft.source === zrodlo.key}
            onClick={() => wybierz(zrodlo.key)}
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
          webPlaceholder="np. podcast, newsletter"
          onChange={(e) => onChange({ ...draft, sourceOther: e.target.value })}
        />
      )}
    </>
  );
}
