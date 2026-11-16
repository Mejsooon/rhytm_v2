import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "Logowanie — rhytm" };

// searchParams to dane żądania — czytamy je w osobnym komponencie pod Suspense.
// Fallback to null, a nie drugi formularz: inaczej w HTML są dwie kopie formularza (duplikat pól i przycisków).
async function Formularz({ searchParams }: { searchParams: PageProps<"/logowanie">["searchParams"] }) {
  const { blad } = await searchParams;
  return <LoginForm oauthError={blad === "oauth"} />;
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
