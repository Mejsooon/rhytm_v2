import type { Metadata } from "next";
import { Suspense } from "react";

import { LinkExpired } from "@/features/auth/link-expired";

export const metadata: Metadata = { title: "Link wygasł — rhytm" };

// searchParams to dane żądania — czytamy je pod Suspense, reszta ekranu może zostać wstępnie wyrenderowana.
// Do resendLink trafia tylko znana wartość (recovery albo signup), nigdy surowy parametr.
async function Ekran({
  searchParams,
}: {
  searchParams: PageProps<"/link-wygasl">["searchParams"];
}) {
  const { type } = await searchParams;
  return <LinkExpired type={type === "recovery" ? "recovery" : "signup"} />;
}

export default function LinkWygaslPage(props: PageProps<"/link-wygasl">) {
  return (
    <Suspense
      fallback={<div className="min-h-dvh bg-white min-[800px]:bg-panel" />}
    >
      <Ekran searchParams={props.searchParams} />
    </Suspense>
  );
}
