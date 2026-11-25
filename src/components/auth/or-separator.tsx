import { cn } from "@/lib/utils";

// Linia z napisem pośrodku („lub e-mailem” / „lub”)
export function OrSeparator({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 text-xs text-muted-foreground",
        className,
      )}
    >
      <span className="h-px flex-1 bg-border" />
      {label}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
