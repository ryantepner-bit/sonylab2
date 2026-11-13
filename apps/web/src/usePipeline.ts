import { useCallback, useEffect, useRef, useState } from "react";
import type { Graph } from "@sonylab/engine";
import type { WorkerIn, WorkerOut } from "./pipeline.worker";

export interface PipelineResult { width: number; height: number; data: Uint8ClampedArray; computed: number; cacheHits: number; ms: number; }
type ResultMsg = Extract<WorkerOut, { type: "result" }>;
const toResult = (m: ResultMsg): PipelineResult => ({ width: m.width, height: m.height, data: m.data, computed: m.computed, cacheHits: m.cacheHits, ms: m.ms });

/**
 * Owns the processing worker. Only ONE preview run is ever in flight; while it runs, newer graphs
 * overwrite a single "pending" slot (latest wins). This is what stops the queue backing up when
 * sliders are dragged during an expensive effect (the cause of the "stops rendering" stall).
 */
export function usePipeline(graph: Graph) {
  const worker = useRef<Worker | null>(null);
  const inFlight = useRef(false);
  const pending = useRef<Graph | null>(null);
  const hasSource = useRef(false);
  const nextId = useRef(1);
  const graphRef = useRef(graph);
  graphRef.current = graph;
  const waiters = useRef(new Map<number, { resolve: (r: PipelineResult) => void; reject: (e: Error) => void }>());
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceVersion, setSourceVersion] = useState(0);

  const pump = useCallback(() => {
    const w = worker.current, g = pending.current;
    if (!w || !g || inFlight.current || !hasSource.current) return;
    pending.current = null;
    inFlight.current = true;
    setBusy(true);
    const msg: WorkerIn = { type: "run", runId: nextId.current++, quality: "preview", graph: g };
    w.postMessage(msg);
  }, []);

  useEffect(() => {
    const w = new Worker(new URL("./pipeline.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (ev: MessageEvent<WorkerOut>) => {
      const m = ev.data;
      if (m.quality === "full") {
        const wt = waiters.current.get(m.runId);
        waiters.current.delete(m.runId);
        if (!wt) return;
        if (m.type === "error") wt.reject(new Error(m.message)); else wt.resolve(toResult(m));
        return;
      }
      inFlight.current = false;
      setBusy(false);
      if (m.type === "error") setError(m.message);
      else { setError(null); setResult(toResult(m)); }
      pump();
    };
    w.onerror = (e) => { inFlight.current = false; setBusy(false); setError(e.message || "Worker error"); };
    worker.current = w;
    return () => w.terminate();
  }, [pump]);

  useEffect(() => { pending.current = graph; pump(); }, [graph, sourceVersion, pump]);

  const setSource = useCallback((preview: ImageData, full: ImageData | null, key: string) => {
    const w = worker.current;
    if (!w) return;
    const p = new Uint8ClampedArray(preview.data); // main thread keeps `preview` for display
    const transfer: Transferable[] = [p.buffer as ArrayBuffer];
    const fullMsg = full ? { width: full.width, height: full.height, data: full.data as Uint8ClampedArray } : null;
    if (full) transfer.push(full.data.buffer as ArrayBuffer);
    const msg: WorkerIn = { type: "setSource", sourceKey: key, preview: { width: preview.width, height: preview.height, data: p }, full: fullMsg };
    w.postMessage(msg, transfer);
    hasSource.current = true;
    setSourceVersion((v) => v + 1);
  }, []);

  const exportFull = useCallback(
    () => new Promise<PipelineResult>((resolve, reject) => {
      const w = worker.current;
      if (!w) { reject(new Error("Worker not ready")); return; }
      const id = nextId.current++;
      waiters.current.set(id, { resolve, reject });
      const msg: WorkerIn = { type: "run", runId: id, quality: "full", graph: graphRef.current };
      w.postMessage(msg);
    }),
    [],
  );

  return { result, busy, error, setSource, exportFull };
}
