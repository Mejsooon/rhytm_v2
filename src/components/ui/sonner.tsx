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
      style={
        {
          "--normal-bg": "var(--background)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
