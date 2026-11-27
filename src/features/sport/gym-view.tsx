"use client";

// Zakończony trening pokazuje podsumowanie; „Edytuj” otwiera ten sam dziennik, „Gotowe” wraca.
import { useState } from "react";

import { GymLog } from "./gym-log";
import { GymSummary } from "./gym-summary";
import type { WorkoutData } from "./load-sport";

export function GymView({ data }: { data: WorkoutData }) {
  const [edycja, setEdycja] = useState(false);
  return data.session.completed && !edycja ? (
    <GymSummary data={data} onEdit={() => setEdycja(true)} />
  ) : (
    <GymLog data={data} onDone={() => setEdycja(false)} />
  );
}
