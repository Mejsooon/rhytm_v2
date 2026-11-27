# Plan: Ustawienia i kosz (spec `specs/2026-11-27-ustawienia-v2-design.md`)

Wykonuje Claude sam, jeden przegląd gałęzi na końcu.

1. Migracja `20261206100000_ustawienia_sejfu.sql` + pgTAP + typy.
2. Nawigacja z grupami; Ogólne (Profil, Cele, link do kosza); Konto (E-mail, hasło, sesje, eksport, usunięcie).
3. `/ustawienia/kosz`: lista, przywrócenie na koniec, usunięcie na zawsze; link 404.
4. Sejf: `getVault` zwraca ustawienia, `saveVaultSettings`; czas blokady, schowek, pytanie o hasło przy podglądzie i kopiowaniu; karta stanu.
5. Kalendarz i Powiadomienia: nagłówki i stopki.
6. Testy jednostkowe, e2e, `/code-review`, dziennik, PR. Scalenie po migracji Mejsona i „scal do main”.
