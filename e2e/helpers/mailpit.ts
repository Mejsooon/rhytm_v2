// Odczyt maili z Mailpit (lokalny Supabase: http://127.0.0.1:54324).
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

type Wiadomosc = { ID: string };

// Lista wiadomości do adresu, od najnowszej
async function wiadomosciDo(email: string): Promise<Wiadomosc[]> {
  const odp = await fetch(
    `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
  );
  if (!odp.ok) throw new Error(`Mailpit: wyszukiwanie zwróciło ${odp.status}`);
  const dane = (await odp.json()) as { messages?: Wiadomosc[] };
  return dane.messages ?? [];
}

// Liczba wiadomości do adresu — pozwala poczekać na „nowy” mail po ponownym wysłaniu
export async function countMailsFor(email: string): Promise<number> {
  return (await wiadomosciDo(email)).length;
}

// Czeka na mail do `email` (jeśli `minimum` > 1, na tyle maili) i zwraca pierwszy link /auth/confirm
// z najnowszej wiadomości. Czas oczekiwania: 20 s.
export async function latestLinkFor(
  email: string,
  minimum = 1,
): Promise<string> {
  const adres = email.trim().toLowerCase();
  const koniec = Date.now() + 20_000;

  while (Date.now() < koniec) {
    const lista = await wiadomosciDo(adres);
    if (lista.length >= minimum) {
      const odp = await fetch(`${MAILPIT}/api/v1/message/${lista[0].ID}`);
      if (!odp.ok)
        throw new Error(`Mailpit: odczyt wiadomości zwrócił ${odp.status}`);
      const tresc = (await odp.json()) as { HTML?: string; Text?: string };
      const zrodlo = `${tresc.HTML ?? ""}\n${tresc.Text ?? ""}`;
      // Link w HTML ma &amp; zamiast &
      const trafienie = zrodlo.match(
        /https?:\/\/[^\s"'<>]*\/auth\/confirm[^\s"'<>]*/,
      );
      if (trafienie) return trafienie[0].replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(
    `Mailpit: nie doszedł mail z linkiem /auth/confirm do ${adres}`,
  );
}
