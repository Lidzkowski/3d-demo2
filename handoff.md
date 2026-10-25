# Bieżący stan — jedyna pamięć robocza
Projekt: SHOWCASE-LIQUID-001 | Pakiet: 1.1 | Data: 2026-10-25 | Profil: L2
Aktualizacja: 2026-10-25 (E5a particles+PP: 7d192fd → 9645fb3 WebGPU particles guard → 5f08a1d TDZ fix; V-008 PASS)
Etap/podzadanie: E5a — Cząsteczki GPU i post-processing (R-008, V-008) — ZAKOŃCZONE
Status: W TOKU
Model ostatniego wykonawcy: Qwen3.6-35B-A3B-4bit (omlx)
Następny model: Qwen3.6-35B-A3B-4bit (omlx/Qwen3.6-35B-A3B-4bit)
Odpowiedź użytkownika: BRAK

## Cel i stan
Cel E5a (z karty): cząsteczki GPU (custom shader, orbital motion, scroll influence) i post-processing (bloom + chromatic aberration), jakość przełączalna (Q), wyłącznie WebGL (EffectComposer). Bez zmian logiki sceny/scrolla.

Wykonano (commit 7d192fd, 3 pliki): `src/scene/particles.js` (BufferGeometry, custom ShaderMaterial: aRandom/aSize/aPhase, orbital motion, scroll scene factor, noise displacement, additive blending, soft circle fragment); `src/scene/postprocessing.js` (EffectComposer + RenderPass + UnrealBloomPass + ShaderPass ChromaticAberration; setQuality toggle bloom/CA; setSize resize); `src/main.js` (imports, particle init per quality, PP init WebGL-only, quality toggle Q-key, particles update w animate(), composer render, resize PP).

## Decyzje, próby i blokery
- PP tylko WebGL: EffectComposer/UnrealBloomPass/ShaderPass są WebGL-only → `renderer instanceof THREE.WebGLRenderer` guard. WebGPU = render bezpośredni.
- Jakość: high = 2000 cząstek + bloom 0.6/0.4/0.85 + CA; low = 500 cząstek + bloom 0.3/0.2/0.7 + bez CA.
- Toggle: dispose+recreate particles (geometry+material dispose), setQuality na postProcessing (remove/add CA pass).
- WebGPU detection ulepszona (adapter + device verification), wcześniej z sesji U1.
- **Naprawa WebGPU (9645fb3):** ShaderMaterial (particles) niekompatybilny z WebGPURenderer → error `Material "ShaderMaterial" is not compatible`. Fix: particles init i update w pętli animacji objęte `isWebGLRenderer` guard (taki sam jak postProcessing); debug overlay pokazuje "N/A" dla particles w WebGPU.
- **TDZ (5f08a1d):** `const isWebGLRenderer` deklarowana po pierwszym użyciu (particles init) → `Cannot access 'isWebGLRenderer' before initialization`. Fix: przeniesienie deklaracji przed oba użycia (particles + postProcessing).

Otwarte/blokery/stop: brak.

## Wniosły
- (brak nowych — kod E5a czysty, build i runtime OK)

## Sprawdzenia i Git
Testy: V-008 **PASS** (7d192fd: particles shader aRandom/aPhase obecne w bundle; bloomPass + EffectComposer + UnrealBloomPass; toggleQuality; quality toggle logic; dev server 200 OK; bundle 1.4 MB JS + 10.7 KB CSS + 3 woff2).
Repo/gałąź/baza/checkpoint: main; HEAD = 7d192fd; robocze drzewo czyste.
Staged/unstaged/untracked: puste.
Hash checkpointu: 5f08a1d

## Wznowienie
Następny krok: E5b — Jakość adaptacyjna, dźwięk UI, a11y, mobile (R-009,R-010,R-011,R-012). ALBO — jeśli użytkownik wybierze — sesja Przegląd/naprawa.
