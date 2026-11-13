import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createDefaultRegistry, chainToGraph, serializeProject, parseProject } from "@sonylab/engine";
import type { Params, ParamSpec } from "@sonylab/engine";
import { usePipeline } from "./usePipeline";
import { PRESETS } from "./presets";

const registry = createDefaultRegistry();

interface ChainNode { id: string; type: string; params: Params; bypass: boolean; }
let idCounter = 1;
const newId = () => `n${idCounter++}`;

async function decodeFile(file: File, maxDim: number): Promise<{ preview: ImageData; full: ImageData | null }> {
  const bmp = await createImageBitmap(file, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
  try {
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(bmp, 0, 0);
    const full = ctx.getImageData(0, 0, bmp.width, bmp.height);
    const k = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    if (k >= 1) return { preview: full, full: null }; // small image: preview IS full-res
    const pw = Math.max(1, Math.round(bmp.width * k)), ph = Math.max(1, Math.round(bmp.height * k));
    const c2 = new OffscreenCanvas(pw, ph);
    const ctx2 = c2.getContext("2d", { willReadFrequently: true })!;
    ctx2.imageSmoothingQuality = "high";
    ctx2.drawImage(bmp, 0, 0, pw, ph);
    return { preview: ctx2.getImageData(0, 0, pw, ph), full };
  } finally {
    bmp.close();
  }
}

export function App() {
  const [source, setPreviewImg] = useState<ImageData | null>(null);
  const [previewMax, setPreviewMax] = useState(1200);
  const [exporting, setExporting] = useState(false);
  const [fullSize, setFullSize] = useState("");
  const fileRef = useRef<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [chain, setChain] = useState<ChainNode[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const graph = useMemo(() => chainToGraph(chain), [chain]);
  const { result, busy, error, setSource, exportFull } = usePipeline(graph);

  const loadFile = useCallback(async (file: File, maxDim: number) => {
    try {
      setLoadError(null);
      fileRef.current = file;
      const { preview, full } = await decodeFile(file, maxDim);
      setPreviewImg(preview);
      setFileName(file.name);
      setFullSize(full ? `${full.width}×${full.height}` : `${preview.width}×${preview.height}`);
      setSource(preview, full, `${file.name}:${file.size}:${file.lastModified}:${maxDim}`);
    } catch (e) {
      setLoadError(`Could not decode "${file.name}" (${e instanceof Error ? e.message : "unknown error"}). TIFF is not decodable by most browsers yet.`);
    }
  }, [setSource]);

  useEffect(() => { if (fileRef.current) void loadFile(fileRef.current, previewMax); }, [previewMax, loadFile]);

  // draw preview
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const src = showOriginal ? source : result ? new ImageData(result.data as any, result.width, result.height) : source;
    if (!src) return;
    cv.width = src.width;
    cv.height = src.height;
    cv.getContext("2d")!.putImageData(src, 0, 0);
  }, [result, source, showOriginal]);

  const addNode = (type: string) => {
    const n: ChainNode = { id: newId(), type, params: registry.defaultParams(type), bypass: false };
    setChain((c) => [...c, n]);
    setSelected(n.id);
  };
  const updateNode = (id: string, patch: Partial<ChainNode>) => setChain((c) => c.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  const setParam = (id: string, key: string, v: Params[string]) =>
    setChain((c) => c.map((n) => (n.id === id ? { ...n, params: { ...n.params, [key]: v } } : n)));
  const move = (id: string, dir: -1 | 1) =>
    setChain((c) => {
      const i = c.findIndex((n) => n.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= c.length) return c;
      const copy = [...c];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  const remove = (id: string) => setChain((c) => c.filter((n) => n.id !== id));

  const exportImage = async (mime: "image/png" | "image/jpeg" | "image/webp") => {
    if (!source || exporting) return;
    setExporting(true);
    try {
      const full = await exportFull(); // re-renders the whole chain at ORIGINAL resolution in the worker
      const c = new OffscreenCanvas(full.width, full.height);
      c.getContext("2d")!.putImageData(new ImageData(full.data as any, full.width, full.height), 0, 0);
      const blob = await c.convertToBlob({ type: mime, quality: 0.92 }); // canvas encoders write no EXIF/metadata
      const ext = mime.split("/")[1].replace("jpeg", "jpg");
      download(blob, `${fileName.replace(/\.[^.]+$/, "") || "export"}-sonylab.${ext}`);
    } catch (e) {
      setLoadError(`Export failed: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setExporting(false);
    }
  };

  const saveProject = () => {
    const text = serializeProject({
      name: fileName || "Untitled",
      savedAt: new Date().toISOString(),
      source: source ? { fileName, width: source.width, height: source.height } : null,
      graph,
    });
    download(new Blob([text], { type: "application/json" }), `${fileName.replace(/\.[^.]+$/, "") || "project"}.sonylab.json`);
  };
  const loadProject = async (file: File) => {
    try {
      const p = parseProject(await file.text());
      setChain(p.graph.nodes.filter((n) => n.type !== "source").map((n) => ({ id: n.id, type: n.type, params: n.params, bypass: !!n.bypass })));
      setLoadError(p.source ? `Project loaded. Re-open the original image "${p.source.fileName}" to render it (images are kept separate from project files).` : null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load project");
    }
  };

  const sel = chain.find((n) => n.id === selected) ?? null;
  const byCategory = useMemo(() => {
    const m = new Map<string, ReturnType<typeof registry.list>>();
    for (const op of registry.list()) m.set(op.category, [...(m.get(op.category) ?? []), op]);
    return [...m.entries()];
  }, []);

  return (
    <div className="app" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void loadFile(f, previewMax); }}>
      <header className="topbar">
        <span className="brand">SONYLAB<span className="dim"> // photographic instrument</span></span>
        <span className="spacer" />
        <span className={`led ${busy ? "on" : ""}`} title="processing" />
        <span className="dim mono">{result ? `${result.width}×${result.height} · ${result.ms.toFixed(0)} ms · ${result.computed} computed / ${result.cacheHits} cached` : "idle"}</span>
      </header>

      <aside className="left panel">
        <h3>Image</h3>
        <label className="btn">Open image…<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp" hidden onChange={(e) => e.target.files?.[0] && void loadFile(e.target.files[0], previewMax)} /></label>
        <p className="dim small">or drop a file anywhere. {fileName && <span className="mono">{fileName}</span>}</p>
        <h3>Effects</h3>
        {byCategory.map(([cat, ops]) => (
          <div key={cat}>
            <div className="cat">{cat}</div>
            {ops.map((op) => (
              <button key={op.type} className="btn wide" title={op.description} onClick={() => addNode(op.type)}>+ {op.label}</button>
            ))}
          </div>
        ))}
        <h3>Presets</h3>
        {PRESETS.map((pr) => (
          <button key={pr.name} className="btn wide" title={pr.note} onClick={() => { setChain(pr.chain.map((c) => ({ id: newId(), type: c.type, params: { ...registry.defaultParams(c.type), ...c.params }, bypass: false }))); setSelected(null); }}>{pr.name}</button>
        ))}
        <h3>Preview</h3>
        <label className="param"><span>Max preview size</span>
          <select value={previewMax} onChange={(e) => setPreviewMax(Number(e.target.value))}>{[600, 900, 1200, 1600, 2400].map((n) => <option key={n} value={n}>{n}px</option>)}</select>
        </label>
        <p className="dim small">Exports always render at full {fullSize || "source"} resolution.</p>
        <h3>Project</h3>
        <button className="btn wide" onClick={saveProject}>Save project (.json)</button>
        <label className="btn wide">Load project…<input type="file" accept=".json" hidden onChange={(e) => e.target.files?.[0] && void loadProject(e.target.files[0])} /></label>
      </aside>

      <main className="center">
        <div className="toolbar">
          <button className="btn" onMouseDown={() => setShowOriginal(true)} onMouseUp={() => setShowOriginal(false)} onMouseLeave={() => setShowOriginal(false)}>Hold: original</button>
          <button className={`btn ${fit ? "active" : ""}`} onClick={() => setFit(true)}>Fit</button>
          <button className="btn" onClick={() => { setFit(false); setZoom(1); }}>100%</button>
          <button className="btn" onClick={() => { setFit(false); setZoom((z) => z * 1.25); }}>+</button>
          <button className="btn" onClick={() => { setFit(false); setZoom((z) => z / 1.25); }}>−</button>
          <span className="spacer" />
          {(["image/png", "image/jpeg", "image/webp"] as const).map((m) => (
            <button key={m} className="btn" disabled={!source || exporting} onClick={() => void exportImage(m)}>{exporting ? "…" : "Export"} {m.split("/")[1].toUpperCase()}</button>
          ))}
        </div>
        <div className="stage">
          {!source && <div className="empty">Drop an image to begin</div>}
          <canvas ref={canvasRef} className={source ? "" : "hidden"} style={fit ? { maxWidth: "100%", maxHeight: "100%" } : { width: (source?.width ?? 0) * zoom }} />
        </div>
        {(error || loadError) && <div className="error mono">{error ?? loadError}</div>}
      </main>

      <aside className="right panel">
        <h3>Parameters</h3>
        {!sel && <p className="dim small">Select a node in the chain.</p>}
        {sel && (
          <>
            <div className="mono">{registry.get(sel.type).label} <span className="badge">{registry.get(sel.type).fidelity}</span></div>
            <p className="dim small">{registry.get(sel.type).description}</p>
            {registry.get(sel.type).params.map((s) => (
              <ParamControl key={s.key} spec={s} value={sel.params[s.key]} onChange={(v) => setParam(sel.id, s.key, v)} />
            ))}
          </>
        )}
      </aside>

      <section className="bottom panel">
        <h3>Processing chain <span className="dim small">source → … → output</span></h3>
        <div className="chain">
          <div className="node fixed">SOURCE</div>
          {chain.map((n) => (
            <div key={n.id} className={`node ${n.id === selected ? "sel" : ""} ${n.bypass ? "bypassed" : ""}`} onClick={() => setSelected(n.id)}>
              <div className="mono">{registry.get(n.type).label}</div>
              <div className="nodebtns">
                <button onClick={(e) => { e.stopPropagation(); move(n.id, -1); }}>◀</button>
                <button onClick={(e) => { e.stopPropagation(); move(n.id, 1); }}>▶</button>
                <button onClick={(e) => { e.stopPropagation(); updateNode(n.id, { bypass: !n.bypass }); }}>{n.bypass ? "off" : "on"}</button>
                <button onClick={(e) => { e.stopPropagation(); remove(n.id); }}>✕</button>
              </div>
            </div>
          ))}
          <div className="node fixed">OUTPUT</div>
        </div>
      </section>
    </div>
  );
}

function ParamControl({ spec, value, onChange }: { spec: ParamSpec; value: Params[string]; onChange: (v: Params[string]) => void }) {
  if (spec.kind === "range")
    return (
      <label className="param">
        <span>{spec.label}<span className="mono dim"> {Number(value).toFixed(spec.step < 1 ? 2 : 0)}</span></span>
        <input type="range" min={spec.min} max={spec.max} step={spec.step} value={Number(value)} onChange={(e) => onChange(Number(e.target.value))} />
      </label>
    );
  if (spec.kind === "select")
    return (
      <label className="param">
        <span>{spec.label}</span>
        <select value={String(value)} onChange={(e) => onChange(e.target.value)}>{spec.options.map((o) => <option key={o}>{o}</option>)}</select>
      </label>
    );
  return (
    <label className="param row"><input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} /><span>{spec.label}</span></label>
  );
}

function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
