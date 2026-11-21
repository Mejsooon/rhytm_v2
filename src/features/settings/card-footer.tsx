import { Button, CardFooter as CossCardFooter } from "@/components/controls";
import { cn } from "@/lib/utils";
import type { CardMessage } from "./use-card-form";

// Stopka karty (.foot z CSettings.dc.html): komunikat po lewej, „Cofnij” (tylko przy zmianach) i „Zapisz” po prawej
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
    <CossCardFooter className="max-[799px]:flex-col max-[799px]:items-stretch">
      <span
        role="status"
        className={cn(
          "text-[13px]",
          formError
            ? "text-destructive-foreground"
            : message === "saved"
              ? "text-success"
              : "text-muted-foreground",
        )}
      >
        {formError ?? texts[message]}
      </span>
      <span className="flex gap-2 max-[799px]:[&>button]:flex-1">
        {dirty && (
          <Button variant="ghost" onClick={onReset} className="max-[799px]:h-12">
            Cofnij
          </Button>
        )}
        <Button
          variant="primary"
          disabled={!canSave || saving}
          onClick={onSave}
          className="disabled:opacity-[.64] max-[799px]:h-12"
        >
          Zapisz
        </Button>
      </span>
    </CossCardFooter>
  );
}
