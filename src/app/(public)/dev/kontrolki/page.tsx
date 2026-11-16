import { notFound } from "next/navigation";

import { ControlsDemo } from "./controls-demo";

// Strona podglądu kontrolek — tylko poza produkcją
export default function KontrolkiPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ControlsDemo />;
}
