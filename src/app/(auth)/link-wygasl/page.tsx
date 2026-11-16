import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { LinkExpired } from "@/features/auth/link-expired";

export const metadata: Metadata = { title: "Link wygasł — rhytm" };

// searchParams to dane żądania — czytamy je pod Suspense, reszta ekranu może zostać wstępnie wyrenderowana.
// Do resendLink trafia tylko znana wartość (recovery albo signup), nigdy surowy parametr.
async function Ekran({ searchParams }: { searchParams: PageProps<"/link-wygasl">["searchParams"] }) {
  const { type } = await searchParams;
  return <LinkExpired type={type === "recovery" ? "recovery" : "signup"} />;
}

export default function LinkWygaslPage(props: PageProps<"/link-wygasl">) {
  return (
    <AuthShell headerAction={{ href: "/logowanie", label: "Zaloguj się" }} width={362}>
      <Suspense fallback={null}>
        <Ekran searchParams={props.searchParams} />
      </Suspense>
    </AuthShell>
  );
}
