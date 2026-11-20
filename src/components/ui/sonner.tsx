"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

// Tylko jasny motyw — bez next-themes. Na dole pośrodku; odstęp od dołu z --toast-bottom
// (globals.css): na telefonie nad dolnym paskiem (--tabbar-h), na webie 24 px. Ten sam odstęp
// w obu trybach sonnera (jego próg „mobile” to 600 px, a pasek jest do 799 px).
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="bottom-center"
      offset={{ bottom: "var(--toast-bottom)" }}
      mobileOffset={{ bottom: "var(--toast-bottom)" }}
      className="toaster group"
      toastOptions={{
        classNames: {
          // .toast z coss.css; wersje z „!” przebijają własne style sonnera
          toast:
            "items-center! gap-3! rounded-lg! border! border-border! py-3! pr-3! pl-4! text-sm! shadow-[var(--shadow-lg),0_16px_32px_-12px_rgba(0,0,0,.14)]!",
        },
      }}
      style={
        {
          "--normal-bg": "var(--background)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "12px",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
