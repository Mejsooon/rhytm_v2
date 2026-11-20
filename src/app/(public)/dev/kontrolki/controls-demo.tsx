"use client";

import * as React from "react";

import {
  ActionPopover,
  Button,
  Checkbox,
  Chip,
  DatePicker,
  Dropdown,
  FormDialog,
  MonoLabel,
  Segment,
  StatusBadge,
  Switch,
  TimePicker,
  WordConfirm,
  type BadgeTone,
} from "@/components/controls";

const STREFY = [
  { value: "waw", label: "Europa/Warszawa", hint: "UTC+01:00" },
  { value: "lon", label: "Europa/Londyn", hint: "UTC+00:00" },
  { value: "nyc", label: "Ameryka/Nowy Jork", hint: "UTC−05:00" },
] as const;

const STATUSY: {
  value: string;
  label: string;
  badge: { label: string; tone: BadgeTone };
}[] = [
  {
    value: "todo",
    label: "Do zrobienia",
    badge: { label: "Do zrobienia", tone: "gray" },
  },
  { value: "wip", label: "W toku", badge: { label: "W toku", tone: "blue" } },
  {
    value: "hold",
    label: "Wstrzymane",
    badge: { label: "Wstrzymane", tone: "orange" },
  },
  {
    value: "done",
    label: "Zrobione",
    badge: { label: "Zrobione", tone: "green" },
  },
];

function Sekcja({
  makieta,
  children,
}: {
  makieta: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-b border-border py-6">
      <MonoLabel>{makieta}</MonoLabel>
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </section>
  );
}

export function ControlsDemo() {
  const [popover, setPopover] = React.useState(false);
  const [okno, setOkno] = React.useState(false);
  const [strefa, setStrefa] = React.useState<string | null>("waw");
  const [status, setStatus] = React.useState<string | null>("wip");
  const [pusta, setPusta] = React.useState<string | null>(null);
  const [tydzien, setTydzien] = React.useState("mon");
  const [sw1, setSw1] = React.useState(true);
  const [sw2, setSw2] = React.useState(false);
  const [cb1, setCb1] = React.useState(true);
  const [cb2, setCb2] = React.useState(false);
  const [chip, setChip] = React.useState("pr");
  const [data, setData] = React.useState<string | null>("2026-11-20");
  const [godzina, setGodzina] = React.useState("12:00");
  const [potwierdzono, setPotwierdzono] = React.useState(false);

  return (
    <main className="mx-auto flex max-w-3xl flex-col px-6 py-8 text-sm">
      <h1 className="text-2xl font-semibold">Kontrolki</h1>

      <Sekcja makieta="Settings.dc.html — .dd / .ddpop (lista rozwijana)">
        <div className="w-60">
          <Dropdown
            ariaLabel="Strefa czasowa"
            value={strefa}
            onChange={setStrefa}
            options={[...STREFY]}
          />
        </div>
        <div className="w-60">
          <Dropdown
            ariaLabel="Status"
            value={status}
            onChange={setStatus}
            options={STATUSY}
          />
        </div>
        <div className="w-60">
          <Dropdown
            ariaLabel="Pusta lista"
            value={pusta}
            onChange={setPusta}
            options={[...STREFY]}
            placeholder="Wybierz strefę…"
          />
        </div>
        <div className="h-5 w-60 overflow-hidden">
          <Dropdown
            ariaLabel="Lista w rodzicu z overflow"
            value={strefa}
            onChange={setStrefa}
            options={[...STREFY]}
          />
        </div>
      </Sekcja>

      <Sekcja makieta="Settings.dc.html — dymek (ActionPopover)">
        <ActionPopover
          open={popover}
          onOpenChange={setPopover}
          width={220}
          trigger={<Button>Otwórz dymek</Button>}
        >
          <div className="flex flex-col gap-2">
            <MonoLabel>Godzina</MonoLabel>
            <Button size="sm" onClick={() => setPopover(false)}>
              Gotowe
            </Button>
          </div>
        </ActionPopover>
      </Sekcja>

      <Sekcja makieta="VaultReset.dc.html / MBlockSheet.dc.html — okno i arkusz">
        <Button onClick={() => setOkno(true)}>Otwórz okno</Button>
        <FormDialog
          open={okno}
          onOpenChange={setOkno}
          title="Zresetować sejf?"
          footer={
            <>
              <Button onClick={() => setOkno(false)}>Anuluj</Button>
              <Button variant="primary" onClick={() => setOkno(false)}>
                Zapisz
              </Button>
            </>
          }
        >
          <p className="text-[13px] text-muted-foreground">
            Tej operacji nie da się cofnąć.
          </p>
          <Dropdown
            ariaLabel="Strefa w oknie"
            value={strefa}
            onChange={setStrefa}
            options={[...STREFY]}
          />
        </FormDialog>
      </Sekcja>

      <Sekcja makieta="BlockDialog.dc.html / MBlockSheet.dc.html — segment">
        <Segment
          ariaLabel="Początek tygodnia"
          value={tydzien}
          onChange={setTydzien}
          options={[
            { value: "mon", label: "Pn" },
            { value: "sun", label: "Nd" },
            { value: "sat", label: "Sb" },
          ]}
        />
      </Sekcja>

      <Sekcja makieta="SettingsNotifications.dc.html — przełącznik (.sw)">
        <Switch checked={sw1} onChange={setSw1} ariaLabel="Włączony" />
        <Switch checked={sw2} onChange={setSw2} ariaLabel="Wyłączony" />
        <Switch
          checked={false}
          onChange={() => {}}
          ariaLabel="Nieaktywny"
          disabled
        />
      </Sekcja>

      <Sekcja makieta="MRegister.dc.html — checkbox (.cb)">
        <Checkbox checked={cb1} onChange={setCb1} label="Akceptuję regulamin" />
        <Checkbox checked={cb2} onChange={setCb2} label="Niezaznaczony" />
      </Sekcja>

      <Sekcja makieta="BlockDialog.dc.html — chipy">
        <Chip
          dotColor="#0070f3"
          selected={chip === "st"}
          onClick={() => setChip("st")}
        >
          Studia
        </Chip>
        <Chip
          dotColor="#15803d"
          selected={chip === "pr"}
          onClick={() => setChip("pr")}
        >
          Praca
        </Chip>
        <Chip dashed onClick={() => {}}>
          + Dodaj
        </Chip>
      </Sekcja>

      <Sekcja makieta="Projects.dc.html — plakietki statusu">
        <StatusBadge tone="green">Zrobione</StatusBadge>
        <StatusBadge tone="orange">Wstrzymane</StatusBadge>
        <StatusBadge tone="blue">W toku</StatusBadge>
        <StatusBadge tone="red">Pilne</StatusBadge>
        <StatusBadge tone="gray">Do zrobienia</StatusBadge>
      </Sekcja>

      <Sekcja makieta="Books.dc.html — wybór daty (dp)">
        <DatePicker ariaLabel="Termin" value={data} onChange={setData} />
        <DatePicker
          ariaLabel="Pusta data"
          value={null}
          onChange={setData}
          weekStart="sun"
        />
      </Sekcja>

      <Sekcja makieta="SettingsNotifications.dc.html — wybór godziny (.tmb / .tpop)">
        <TimePicker
          ariaLabel="Godzina przypomnienia"
          value={godzina}
          onChange={setGodzina}
        />
      </Sekcja>

      <Sekcja makieta="VaultReset.dc.html — potwierdzenie słowem">
        <div className="w-full max-w-md">
          <WordConfirm
            word="RESETUJ"
            label="Wpisz RESETUJ, żeby potwierdzić"
            confirmLabel="Zresetuj sejf"
            destructive
            onConfirm={() => setPotwierdzono(true)}
          />
          {potwierdzono && (
            <p className="mt-2 text-[13px] text-success">Potwierdzono.</p>
          )}
        </div>
      </Sekcja>
    </main>
  );
}
