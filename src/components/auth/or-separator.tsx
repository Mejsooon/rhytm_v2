import { cn } from "@/lib/utils";

// Linia z napisem pośrodku („lub e-mailem” / „lub”)
export function OrSeparator({ label, className }: { label: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 text-xs text-[#6b6b6b] max-[799px]:text-[13px] max-[799px]:text-[#8a8a8a]",
        className,
      )}
    >
      <span className="h-px flex-1 bg-[#eaeaea]" />
      {label}
      <span className="h-px flex-1 bg-[#eaeaea]" />
    </div>
  );
}
