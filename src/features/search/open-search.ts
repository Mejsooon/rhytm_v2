// Otwiera okno szukania (command-menu.tsx) z dowolnego miejsca: pasek boczny, 404.
export const OPEN_SEARCH_EVENT = "rhytm:szukaj";

export function openSearch() {
  // Okno potwierdza odbiór przez preventDefault. Bez okna (404 dla gościa) idziemy na /szukaj
  if (window.dispatchEvent(new CustomEvent(OPEN_SEARCH_EVENT, { cancelable: true }))) {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- bez powłoki nie ma tu routera
    window.location.assign("/szukaj");
  }
}
