import { Button } from "@/components/controls";
import { cn } from "@/lib/utils";
import type { CardMessage } from "./use-card-form";

// Stopka karty (.foot z Settings.dc.html): komunikat po lewej, „Cofnij” (tylko przy zmianach) i „Zapisz” po prawej
export function CardFooter({
  message,
  texts,
  formError,
  dirty,
  canSave,
  saving,
  onReset,
  onSave,
}: {
  message: CardMessage;
  texts: { idle: string; dirty: string; saved: string };
  formError?: string;
  dirty: boolean;
  canSave: boolean;
  saving: boolean;
  onReset: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-b-lg border-t border-[#eaeaea] bg-[#fafafa] px-5 py-3 max-[799px]:flex-col max-[799px]:items-stretch">
      <span
        role="status"
        className={cn("text-[13px]", formError ? "text-[#b91c1c]" : message === "saved" ? "text-[#15803d]" : "text-[#666666]")}
      >
        {formError ?? texts[message]}
      </span>
      <span className="flex gap-2 max-[799px]:[&>button]:flex-1">
        {dirty && (
          <Button onClick={onReset} className="max-[799px]:h-12">
            Cofnij
          </Button>
        )}
        <Button variant="primary" disabled={!canSave || saving} onClick={onSave} className="disabled:opacity-40 max-[799px]:h-12">
          Zapisz
        </Button>
      </span>
    </div>
  );
}
