# PROJECT_STATE

## Phase status
- **Phase 1 — Architecture + runnable app: COMPLETE (with caveats below)**
- Phases 2–8: not started

## What exists
- npm-workspaces monorepo, strict TypeScript.
- `@sonylab/engine`: typed op registry, DAG evaluator (cycle/missing-node validation, content-addressed cache, bypass), versioned project format with migration hook, camera-profile provenance schema (schema only, **no camera data**).
- Ops (CPU, RGBA8): Invert, Channel Mixer (3×3), Additive Noise (seeded; artistic, not a sensor model), Pixel Sort (H/V, luminance/R/G/B key, threshold window, descending).
- `@sonylab/web`: Vite + React app, dark instrument-style layout (left library / center preview / right params / bottom chain), drag-drop open (PNG/JPEG/WebP/GIF/BMP via browser decoder), worker-based processing, before/after (hold), zoom/fit, PNG/JPEG/WebP export at full source resolution, project save/load (images kept separate).

## Verification honesty
- Engine tests (15) were executed in the authoring sandbox via a small shim for `node:test` (vitest was not installable offline): **15/15 passed**. Run `npm test` yourself for the real vitest run.
- The web app was **NOT built or run** (no network → no `npm install`, no Vite, no React types). It has not been type-checked. Expect possible small type/runtime fixes on first `npm run typecheck` / `npm run dev`.
- No GPU code exists yet. Everything is CPU in a worker.

## Update 1 (post-Phase 1)
- FIX: preview stalling. Cause: every slider tick queued a full-resolution run in the worker, so heavy effects (esp. pixel sort) backed up. Now only one preview run is in flight, latest graph wins; previews render at a downscaled proxy (default 1200px, selectable); export re-renders at original resolution in the worker.
- Pixel sort no longer allocates an array per interval (much faster on big images).
- NEW ops: Liquid Warp, Bulge/Pinch, Kaleidoscope, RGB Split (linear/radial), Bit Crush + Dither (Bayer/noise), Tracking Tear, Macroblock Drift, Slice Stutter, Feedback Tunnel, Gradient Map (5 ramps). 5 presets ("inspired by", not recreations).
- Tests: 30/30 passing in sandbox via node:test shim. Web app still not built/typechecked by the author (the user ran an earlier build).
- Not measured: actual speed on large photos. Expect feedbackTunnel and warp to be the slowest ops.

## Known limitations
- Preview runs at full resolution (no proxy yet); big images will be slow until Phase 2.
- Linear chain only in UI; no layers, undo/redo, crop/resize yet.
- Loading a project restores the chain but you must re-open the source image.
- TIFF not supported yet.

## TODO (by phase)
- P2: preview proxy + full-res export path, WebGL2 backend, undo/redo, layers, crop/resize, mirroring/kaleidoscope, gradients/gradient maps, HSV/HSL, quantize/posterize/dither, mask-based + random sort, better noise, TIFF.
- P3: research real Sony specs from primary sources (Sony manuals/spec sheets, EXIF from real samples); fill `CameraProfile` with confidence + sources; tech info panel.
- P4: float linear pipeline; lens/PSF/vignette/distortion/CA; IR-cut & filters.
- P5: sensor + CFA + demosaic + noise models + analog stage + DSP + JPEG model.
- P6: modification lab with interacting mods and phenomenon explanations.
- P7: visual node editor (fan-in, mix, groups, safe feedback).
- P8: presets, project duplication/history, Tauri hardening (scaffold added, UNBUILT; see README).
- Docs: SOURCES.md, per-effect fidelity table once camera data exists.
