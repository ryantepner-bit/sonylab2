/// <reference lib="webworker" />
import { createDefaultRegistry, evaluateGraph, pruneCache } from "@sonylab/engine";
import type { EvalCache, Graph, ImageBuffer } from "@sonylab/engine";

const reg = createDefaultRegistry();
const caches: Record<"preview" | "full", EvalCache> = { preview: new Map(), full: new Map() };
let sources: { preview: ImageBuffer; full: ImageBuffer } | null = null;
let sourceKey = "";

type Raw = { width: number; height: number; data: Uint8ClampedArray };
export type Quality = "preview" | "full";
export type WorkerIn =
  | { type: "setSource"; sourceKey: string; preview: Raw; full: Raw | null }
  | { type: "run"; runId: number; quality: Quality; graph: Graph };
export type WorkerOut =
  | { type: "result"; runId: number; quality: Quality; width: number; height: number; data: Uint8ClampedArray; computed: number; cacheHits: number; ms: number }
  | { type: "error"; runId: number; quality: Quality; message: string };

const post = (m: WorkerOut, t?: Transferable[]) => (self as unknown as Worker).postMessage(m, t ?? []);

self.onmessage = (ev: MessageEvent<WorkerIn>) => {
  const m = ev.data;
  if (m.type === "setSource") {
    caches.preview.clear();
    caches.full.clear();
    sources = { preview: m.preview, full: m.full ?? m.preview };
    sourceKey = m.sourceKey;
    return;
  }
  try {
    if (!sources) throw new Error("No source image loaded");
    const t0 = performance.now();
    const cache = caches[m.quality];
    const { image, stats, stageKeys } = evaluateGraph(m.graph, sources[m.quality], `${sourceKey}:${m.quality}`, reg, cache);
    pruneCache(cache, stageKeys.values());
    const copy = new Uint8ClampedArray(image.data); // cache keeps its own buffer; transfer a copy
    if (m.quality === "full") cache.clear(); // don't hold huge intermediates after an export
    post({ type: "result", runId: m.runId, quality: m.quality, width: image.width, height: image.height, data: copy, computed: stats.computed, cacheHits: stats.cacheHits, ms: performance.now() - t0 }, [copy.buffer as ArrayBuffer]);
  } catch (e) {
    post({ type: "error", runId: m.runId, quality: m.quality, message: e instanceof Error ? e.message : String(e) });
  }
};
