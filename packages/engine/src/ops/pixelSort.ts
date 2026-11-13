import type { OpDefinition } from "../types";
import { cloneImage, luma } from "../image";

type SortKey = "luminance" | "red" | "green" | "blue";

function keyOf(r: number, g: number, b: number, mode: SortKey): number {
  switch (mode) {
    case "red": return r;
    case "green": return g;
    case "blue": return b;
    default: return luma(r, g, b);
  }
}

/**
 * Sorts contiguous runs ("intervals") of pixels along each row or column.
 * A pixel belongs to an interval when its luminance lies in [low, high].
 * Pixels outside the range are left in place and act as interval boundaries.
 */
export const pixelSort: OpDefinition = {
  type: "pixelSort",
  version: 1,
  label: "Pixel Sort",
  category: "sorting",
  fidelity: "artistic",
  description: "Sorts runs of pixels selected by a luminance threshold window, per row or column.",
  params: [
    { kind: "select", key: "direction", label: "Direction", options: ["horizontal", "vertical"], default: "horizontal" },
    { kind: "select", key: "sortBy", label: "Sort key", options: ["luminance", "red", "green", "blue"], default: "luminance" },
    { kind: "range", key: "low", label: "Threshold low", min: 0, max: 255, step: 1, default: 60 },
    { kind: "range", key: "high", label: "Threshold high", min: 0, max: 255, step: 1, default: 220 },
    { kind: "bool", key: "reverse", label: "Descending", default: false },
  ],
  run(input, p) {
    const out = cloneImage(input);
    const { width: w, height: h } = out;
    const d = out.data;
    const horizontal = p.direction === "horizontal";
    const mode = p.sortBy as SortKey;
    const lo = Number(p.low);
    const hi = Number(p.high);
    const sign = p.reverse ? -1 : 1;

    const lines = horizontal ? h : w;
    const len = horizontal ? w : h;
    const step = horizontal ? 4 : w * 4;

    const packed = new Uint32Array(len);
    const keys = new Float32Array(len);
    const idx = new Uint32Array(len);

    for (let line = 0; line < lines; line++) {
      const base = horizontal ? line * w * 4 : line * 4;
      let t = 0;
      while (t < len) {
        const idx0 = base + t * step;
        const l0 = luma(d[idx0], d[idx0 + 1], d[idx0 + 2]);
        if (l0 < lo || l0 > hi) { t++; continue; }
        let end = t;
        while (end < len) {
          const j = base + end * step;
          const l = luma(d[j], d[j + 1], d[j + 2]);
          if (l < lo || l > hi) break;
          end++;
        }
        const n = end - t;
        if (n > 1) {
          const order = idx.subarray(0, n);
          for (let k = 0; k < n; k++) {
            const j = base + (t + k) * step;
            packed[k] = (d[j] | (d[j + 1] << 8) | (d[j + 2] << 16) | (d[j + 3] << 24)) >>> 0;
            keys[k] = keyOf(d[j], d[j + 1], d[j + 2], mode);
            order[k] = k;
          }
          order.sort((a, b) => sign * (keys[a] - keys[b]) || a - b); // stable tie-break
          for (let k = 0; k < n; k++) {
            const v = packed[order[k]];
            const j = base + (t + k) * step;
            d[j] = v & 255;
            d[j + 1] = (v >>> 8) & 255;
            d[j + 2] = (v >>> 16) & 255;
            d[j + 3] = (v >>> 24) & 255;
          }
        }
        t = end;
      }
    }
    return out;
  },
};
