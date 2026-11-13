import type { ImageBuffer } from "./types";

export function createImage(width: number, height: number): ImageBuffer {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}
export function cloneImage(src: ImageBuffer): ImageBuffer {
  return { width: src.width, height: src.height, data: new Uint8ClampedArray(src.data) };
}
/** Rec. 709 luma on 0..255 values (applied to gamma-encoded values; fine for sorting keys). */
export function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export type EdgeMode = "clamp" | "wrap" | "mirror";

export function wrapIndex(i: number, n: number): number {
  return ((i % n) + n) % n;
}
function fixIndex(i: number, n: number, mode: EdgeMode): number {
  if (mode === "clamp") return i < 0 ? 0 : i >= n ? n - 1 : i;
  if (mode === "wrap") return wrapIndex(i, n);
  const p = 2 * n;
  const m = wrapIndex(i, p);
  return m < n ? m : p - 1 - m;
}
/** Bilinear sample of all 4 channels at fractional (x, y); pixel centres sit on integers. Writes into dst[o..o+3]. */
export function sampleBilinear(src: ImageBuffer, x: number, y: number, dst: Uint8ClampedArray, o: number, mode: EdgeMode = "clamp"): void {
  const w = src.width, h = src.height, s = src.data;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const xa = fixIndex(x0, w, mode), xb = fixIndex(x0 + 1, w, mode);
  const ya = fixIndex(y0, h, mode), yb = fixIndex(y0 + 1, h, mode);
  const i00 = (ya * w + xa) * 4, i10 = (ya * w + xb) * 4, i01 = (yb * w + xa) * 4, i11 = (yb * w + xb) * 4;
  for (let c = 0; c < 4; c++) {
    const top = s[i00 + c] * (1 - fx) + s[i10 + c] * fx;
    const bot = s[i01 + c] * (1 - fx) + s[i11 + c] * fx;
    dst[o + c] = top * (1 - fy) + bot * fy;
  }
}
