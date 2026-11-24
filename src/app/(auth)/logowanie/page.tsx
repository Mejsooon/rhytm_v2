import type { Metadata } from "next";
import { Info } from "lucide-react";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "Logowanie — rhytm" };

// searchParams to dane żądania — czytamy je w osobnym komponencie pod Suspense.
// Fallback to null, a nie drugi formularz: inaczej w HTML są dwie kopie formularza (duplikat pól i przycisków).
async function Formularz({
  searchParams,
}: {
  searchParams: PageProps<"/logowanie">["searchParams"];
}) {
  const { blad, konto } = await searchParams;
  return (
    <>
      {/* Po „Usuń konto” (Ustawienia → Ogólne): notka w stylu .alert.info */}
      {konto === "usuniete" && (
        <p
          role="status"
          className="m-0 flex items-start gap-2.5 rounded-lg border border-info-border bg-info/[.04] px-3.5 py-3 text-sm leading-normal max-[799px]:mb-4"
        >
          <Info
            aria-hidden="true"
            className="mt-0.5 size-4 flex-none text-info"
            strokeWidth={2}
          />
          <span>
            Konto oznaczone do usunięcia. Przez 30 dni możesz je przywrócić —
            wystarczy się zalogować.
          </span>
        </p>
      )}
      <LoginForm oauthError={blad === "oauth"} />
    </>
  );
}

export default function LogowaniePage(props: PageProps<"/logowanie">) {
  return (
    <AuthShell headerAction={{ href: "/rejestracja", label: "Załóż konto" }}>
      <Suspense fallback={null}>
        <Formularz searchParams={props.searchParams} />
      </Suspense>
    </AuthShell>
  );
}
