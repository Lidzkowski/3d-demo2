# Bieżący stan — jedyna pamięć robocza
Projekt: SHOWCASE-LIQUID-001 | Pakiet: 1.1 | Data: 2026-10-26 | Profil: L2
Aktualizacja: 2026-10-26 (re-test użytkownika: litery + klik kart — naprawione/ zdiagnozowane)
Etap/podzadanie: Poprawki błędów (zadanie użytkownika): runda 2
Status: GOTOWE
Model ostatniego wykonawcy: Swift-Qwen3.8-27B-Q4_K_M (omlx)
Następny model: Qwen3.6-35B-A3B-4bit (omlx/Qwen3.6-35B-A3B-4bit)
Odpowiedź użytkownika: BRAK

## Cel i stan
Użytkownik po re-teście zgłosił: (1) litery napisu głównego nadal na sobie; (2) kolory nadal nie zmieniają się po kliknięciu karty.

| # | Problem | Rozwiązanie | Status |
|---|---------|-------------|--------|
| 1 | Nakładanie liter hero trwało przy -0.02em (≈6 px/literę przy --step-7 do 288px); dodatkowo GSAP `fromTo` setował inline `letterSpacing`, które nadpisywało CSS | `letter-spacing: 0em` w `.hero-title` (base.css) + usunięcie `letterSpacing` ze scrubu GSAP (typography.js) — spacing wyłącznie z arkusza, drift `yPercent` zachowany | NAPRAWIONE |
| 2 | Klik → brak zmian | Audyt pełnego łańcucha: handler (main.js:361-368), `select()`/`userSelected` lock/`update()` (palette.js), `setPalette` obu materiałów (blob.js:34,232), tokeny `:root[data-palette]` (tokens.css:39-63), overlaye (kursor/cursor-dot/ring `pointer-events:none`, `.palette-card { pointer-events:auto }`) — **kod poprawny we wszystkich warstwach**; jedyne spójne wyjaśnienie „nic się nie zmienia” = przeglądarka użytkownika na starym bundle (HMR nie zaaplikowane). Wymagane twarde odświeżenie (Cmd+Shift+R) / ponowne otwarcie taba | ZDIAGNOZOWANE (hard refresh) |

## Decyzje, próby i blokery
- Hero: 0em usuwa ryzyko nakładania przy każdym rozmiarze clamp; look display utrzymuje line-height 0.9 + krój Space Grotesk; animacja rozjazdu trackingu przy scrollu zrezygnowana (drift pionowy zostaje).
- Klik: nie ma dowodu na błąd kodu — żadna zmiana w palette.js/main.js; zmiana hero nie mogła wpłynąć na paletę. Jeśli po hard refresh problem wróci → prosić o konsolę DevTools (błędy JS) i ekranik karta+scena, wtedy realny bug.
- Shell net blocked (curl/ps denied) — świeżość dev-servera nieprze-testowana lokalnie; build + `docs/` odświeżone.

Otwarte/blokery/stop: brak.

## Wnioski
- Build po poprawkach: JS 1419.15 KB (gzip 390.27 KB), CSS 12.01 KB; warning chunk >500KB (three.js) — znany.
- E7 (GitHub Pages) = następny etap główny.

## Sprawdzenia i Git
Testy: V-021 **PASS** (build exit 0; statyczny audyt hero tracking CSS+GSAP bez kolizji; audyt łańcucha klik→paleta poprawny). V-013/V-014 aktualne (grep CDN: 0 hitów; build OK).
Repo/gałąź/baza/checkpoint: main; HEAD przed: 98bc76c; commit rundy 2: zobacz hash poniżej (drzewo czyste).
Staged: jawnie: handoff.md, verification.md, src/styles/base.css, src/ui/typography.js (bez node_modules/dane/sekrety; docs/ gitignored).
Hash checkpointu: 98bc76c (przed) → NOWY (runda 2, 4 pliki).

## Wznowienie
1. Użytkownik: hard refresh (Cmd+Shift+R) i test: (a) napis „LIQUID” bez nakładania, (b) klik karty palety → akcenty UI + blob zmieniają kolor, `.is-active` wskazuje wybrana karta.
2. Jeśli nadal błąd: DevTools Console (błędy JS) + wersja dev-servera vs `npm run dev` od nowa.
3. E7 — Konfiguracja GitHub Pages (R-016,R-017), ręcznie z użytkownikiem (push = osobna zgoda).
