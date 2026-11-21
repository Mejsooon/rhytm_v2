"use client";

import * as React from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dropdown,
  TextField,
} from "@/components/controls";
import { parseDecimal, profileSchema } from "@/features/profile/schemas";
import { saveProfile } from "./actions";
import { AvatarRow } from "./avatar-row";
import { CardFooter } from "./card-footer";
import { useCardForm } from "./use-card-form";

export type ProfileValues = {
  name: string;
  tz: string;
  kg: string;
  cm: string;
};

// Karta „Profil” (CSettings.dc.html): błędy pól na żywo, Zapisz tylko przy zmianach i bez błędów
export function ProfileCard({
  saved,
  timezones,
  userId,
  avatarUrl,
}: {
  saved: ProfileValues;
  userId: string;
  avatarUrl: string | null;
  timezones: { value: string; city: string; offset: string }[];
}) {
  const form = useCardForm(saved);
  const { value } = form;
  const [saving, setSaving] = React.useState(false);
  const [serverErrors, setServerErrors] = React.useState<
    Record<string, string>
  >({});

  // Błędy na żywo z tego samego schematu co na serwerze
  const wynik = profileSchema.safeParse({
    display_name: value.name,
    timezone: value.tz,
    weight_kg: value.kg,
    height_cm: value.cm,
  });
  const live: Record<string, string> = {};
  if (!wynik.success) {
    for (const issue of wynik.error.issues) {
      const pole = String(issue.path[0]);
      if (!(pole in live)) live[pole] = issue.message;
    }
  }
  const errors = { ...serverErrors, ...live };

  function zmien(patch: Partial<ProfileValues>) {
    setServerErrors({});
    form.set(patch);
  }

  async function zapisz() {
    setSaving(true);
    try {
      const odpowiedz = await saveProfile({
        display_name: value.name,
        timezone: value.tz,
        weight_kg: parseDecimal(value.kg),
        height_cm: parseDecimal(value.cm),
      });
      if (odpowiedz.ok) {
        setServerErrors({});
        form.markSaved({ ...value, name: value.name.trim() });
      } else {
        setServerErrors(odpowiedz.errors);
      }
    } catch {
      setServerErrors({ form: "Nie udało się zapisać. Spróbuj ponownie." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle as="h2">Profil</CardTitle>
          <CardDescription>
            Waga i wzrost służą do liczenia kcal biegów.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Zdjęcie zapisuje się od razu, niezależnie od „Zapisz” poniżej; inicjał z zapisanej nazwy */}
        <AvatarRow
          userId={userId}
          avatarUrl={avatarUrl}
          displayName={saved.name}
        />
        <div className="grid grid-cols-2 gap-4 max-[799px]:grid-cols-1">
          <TextField
            label="Wyświetlana nazwa"
            type="text"
            value={value.name}
            error={errors.display_name}
            onChange={(e) => zmien({ name: e.target.value })}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">Strefa czasowa</span>
            <Dropdown
              variant="select"
              ariaLabel="Strefa czasowa"
              value={value.tz}
              onChange={(tz) => zmien({ tz })}
              options={timezones.map((t) => ({
                value: t.value,
                label: t.city,
                hint: t.offset,
              }))}
            />
          </div>
          <TextField
            label="Waga (kg)"
            type="text"
            inputMode="decimal"
            className="tabular-nums"
            placeholder="np. 75"
            value={value.kg}
            error={errors.weight_kg}
            onChange={(e) => zmien({ kg: e.target.value })}
          />
          <TextField
            label="Wzrost (cm)"
            type="text"
            inputMode="numeric"
            className="tabular-nums"
            placeholder="np. 180"
            value={value.cm}
            error={errors.height_cm}
            onChange={(e) => zmien({ cm: e.target.value })}
          />
        </div>
      </CardContent>
      <CardFooter
        message={form.message}
        texts={{
          idle: "Waga i wzrost są opcjonalne.",
          dirty: "Masz niezapisane zmiany.",
          saved: "Zapisano ✓",
        }}
        formError={serverErrors.form}
        dirty={form.dirty}
        canSave={form.dirty && Object.keys(live).length === 0}
        saving={saving}
        onReset={() => {
          setServerErrors({});
          form.reset();
        }}
        onSave={zapisz}
      />
    </Card>
  );
}
