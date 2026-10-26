# Bieżący stan — jedyna pamięć robocza
Projekt: SHOWCASE-LIQUID-001 | Pakiet: 1.1 | Data: 2026-10-26 | Profil: L2
Aktualizacja: 2026-10-26 (naprawa 3 błędów zgłoszonych przez użytkownika — ZAKOŃCZONE)
Etap/podzadanie: Poprawki błędów (zadanie użytkownika): 1→2→3 wykonane
Status: W TOKU
Model ostatniego wykonawcy: Qwen3.6-35B-A3B-4bit (omlx)
Następny model: Qwen3.6-35B-A3B-4bit (omlx/Qwen3.6-35B-A3B-4bit)
Odpowiedź użytkownika: BRAK

## Cel i stan
Zadanie użytkownika — 3 błądy naprawione po kolei:

| # | Błąd | Pliki zmienione | Naprawa | Status |
|---|------|-----------------|---------|--------|
| 1 | Główny napis — litery nachodziły na siebie | `src/styles/base.css`, `src/ui/typography.js` | tracking hero -0.045em → -0.02em (CSS + GSAP scrub spójne: -0.02em → 0em) | NAPRAWIONE |
| 2 | Kolor zmieniał się tylko raz; klik karty nie działał (scena nadpisywała) | `src/ui/palette.js` | osobny `applySelection()` (wybór sceniczny, bez side-effects) vs `select()` (klik karty → `userSelected` lock); w `update()`: manualLocked wygrywa wszędzie (incl. scena Palette); poza sceną trzyma `sceneTarget`; kolejne kliki działają i się utrzymują | NAPRAWIONE |
| 3 | Wydajność animacji i sceny (płynnie na słabym sprzęcie, bez utraty jakości) | `src/main.js`, `src/scene/postprocessing.js` | (a) keyLight.castShadow usunięte — brak odbiorników cieni w scenie = zero zmiany wizualnej, oszczędność całego shadow pass/klatkę; (b) adaptacyjny pixelRatio `applyRendererDpr()`: low→min(dpr,1.5), high→min(dpr,2), sync `uPixelRatio` cząstek + `composer.setSize`; (c) bloom UnrealBloomPass w połowie rozdzielczości (override setSize ×0.5, RT bazowe pełne) — glow niedostrzegalnie ten sam, ~4x tańsze rozmycie; (d) `timer.getDelta()` raz na klatkę | NAPRAWIONE |

⚠️ Commit zawiera **również wcześniejsze niezcommittowane zmiany użytkownika** (`src/main.js` oświetlenie studio, `src/scene/blob.js` tuning materiałów, `src/scene/postprocessing.js` wartości bloom, `src/ui/palette.js` próba userSelected + click handler w main.js) — chronione, nic nie cofnięto; committowane razem z poprawkami jako jeden zweryfikowany stan.

## Decyzje, próby i blokery
- Bug 1: -0.02em zachowuje tight display look; przy clamp do 288px nakładanie (≈13 px na literę przy -0.045em) zniesione.
- Bug 2: semantyka wg komentarzy pliku — „deterministic default f(scene)" do pierwszego kliknięcia, potem wybór manualny jest lockiem; scroll po sekcji Palette przed kliknięciem nadal steruje paletą.
- Bug 3: wszystkie pozycje bez widocznej utraty jakości; na mocnym sprzęcie nic się nie zmienia (DPR cap aktywny tylko przy degrade <30 fps).
- Ocena wizualna/FPS na realnym urządzeniu = rola użytkownika (headless SwiftShader nie przenosi się).

Otwarte/blokery/stop: brak.

## Wniosły
- Build po poprawkach: JS 1419.19 KB (gzip 390.29 KB), CSS 12.01 KB, 3 woff2 lokalne; warning chunk >500KB (three.js) — znany, raport w E6/V-014.
- E7 (GitHub Pages) = następny etap główny.

## Sprawdzenia i Git
Testy: V-020 **PASS** (build exit 0, 34 moduły, 1.36s; analiza statyczna 3 napraw: tracking CSS+GSAP spójny; palette select/update path; shadow/DPR/bloom/delta). V-013..V-014 aktualne (grep CDN: 0 hitów w src/; build OK).
Repo/gałąź/baza/checkpoint: main; HEAD przed: ab07a85; commit poprawek: DO DOPISANIA.
Staged: jawnie: handoff.md, verification.md, src/main.js, src/scene/blob.js, src/scene/postprocessing.js, src/ui/palette.js, src/ui/typography.js, src/styles/base.css (bez node_modules/dane/sekrety; docs/ gitignored).
Hash checkpointu: ab07a85 (przed poprawkami) → commit bugfix: DO DOPISANIA.

## Wznowienie
Następny krok: E7 — Konfiguracja GitHub Pages (R-016,R-017), ręcznie z użytkownikiem (push = osobna zgoda).
