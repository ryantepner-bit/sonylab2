# SonyLab — Architecture

## Principles
1. **Engine is UI-independent.** `packages/engine` has no React/DOM/WebGL imports. It runs in a Worker, in Node (tests), and later in Tauri.
2. **Ops are pure.** `run(input, params) -> new buffer`. Never mutate input. This makes caching, undo, and parallel execution safe.
3. **Graph, not a hard-coded pipeline.** Everything (including the future camera stages) is a node in a typed DAG. Phase 1 UI exposes a linear chain; the evaluator already validates cycles/missing nodes.
4. **Content-addressed cache.** Node key = hash of (upstream key, op type+version, params). Editing one node recomputes only it and its descendants. Bypassed nodes share their upstream key.
5. **Provenance everywhere.** Camera parameters are `Sourced<T>` (value, confidence, sources). Ops carry a `fidelity` tag: `artistic | physically-motivated | validated`. Nothing is labelled `validated` until compared against reference measurements.
6. **Never block the UI.** Processing runs in a Web Worker; results are tagged with a runId and stale ones are dropped.

## Packages
| Path | Role |
|---|---|
| `packages/engine` | Types, op registry, graph evaluator, cache, project format, camera-profile schema, ops |
| `apps/web` | React UI, worker host, export, project save/load |
| `src-tauri/` (Phase 8) | Windows packaging; Rust only for measured needs (native file I/O, TIFF, possibly heavy kernels) |
| `packages/gpu` (Phase 2+) | WebGL2 backend, WebGPU backend where available |
| `packages/camera-profiles` (Phase 3) | Sourced camera data + docs |

## Planned execution backends
Each op may supply `run` (CPU, worker) and later `runGPU` (WebGL2 fragment pass). The scheduler picks GPU when available and keeps data on-GPU between adjacent GPU ops to avoid readbacks. CPU-only ops (pixel sorting, demosaicing variants) stay in workers. Pixel format will move from RGBA8 to float16/32 linear-light before the sensor stage (Phase 4/5) because physical simulation needs linear, high-dynamic-range data; Phase 1 uses RGBA8 deliberately.

## Camera pipeline (target)
`Scene (photo, treated as scene-referred approximation)` → Optics (PSF/blur, distortion, vignette, CA) → Filters (IR-cut, tint) → Sensor (photosite sampling, CFA, shot/read/FPN/dark-current noise, saturation) → Analog (gain, row/col offsets, crosstalk, clipping) → Digital (demosaic, WB, matrix, gamma/tone, sharpen, NR, JPEG). Each stage is a node group: bypassable, replaceable, and its output inspectable.

**Core limitation:** a finished photograph is already a processed, display-referred image. Stages like "remove IR filter" or "raw sensor noise" can only be approximations from that data. Docs will label them accordingly.

## Project format
`{ format:"sonylab-project", version, name, savedAt, source ref, graph }`. Images are referenced, never embedded or modified. `parseProject` rejects newer versions and runs a migration chain for older ones.

## Testing
Vitest in `packages/engine/test`: op properties (involution, identity, determinism, multiset preservation), graph (cache reuse, bypass, cycles), project round-trip.

## Risks / open decisions
- TIFF decode in browsers: needs a JS decoder (e.g. UTIF) or Tauri/Rust.
- WebGPU support is uneven; WebGL2 is the baseline.
- Large-image memory: RGBA8 at 24 MP = ~96 MB per buffer; cache is pruned per run, tiling/preview-resolution proxies come in Phase 2.
