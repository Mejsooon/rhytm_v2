import type { Metadata } from "next";

import { ResetSteps } from "@/features/auth/reset-steps";

export const metadata: Metadata = { title: "Reset hasła — rhytm" };

export default function ResetHaslaPage() {
  return <ResetSteps />;
}
