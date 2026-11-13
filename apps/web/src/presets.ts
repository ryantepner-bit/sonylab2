import type { Params } from "@sonylab/engine";

export interface Preset { name: string; note: string; chain: { type: string; params: Params }[]; }

/** Starting points in the spirit of 90s/00s IDM-era visuals. Not recreations of any specific artwork. */
export const PRESETS: Preset[] = [
  { name: "Grotesque Portrait", note: "swollen centre, ripple, grain, radial fringing", chain: [
    { type: "bulge", params: { strength: 0.95, radius: 0.75, cy: 0.45 } },
    { type: "warp", params: { amount: 10, frequency: 2, octaves: 2, seed: 7 } },
    { type: "noise", params: { amount: 18 } },
    { type: "rgbSplit", params: { mode: "radial", amount: 7 } } ] },
  { name: "Tracking Error", note: "tape tear, 3-level dither, misregistration", chain: [
    { type: "vhsTear", params: { amount: 90, bands: 10, jitter: 3, chroma: 8, seed: 3 } },
    { type: "crush", params: { levels: 6, dither: "bayer4" } },
    { type: "rgbSplit", params: { mode: "linear", amount: 5 } },
    { type: "noise", params: { amount: 20 } } ] },
  { name: "Acid Tunnel", note: "feedback + kaleidoscope + acid ramp", chain: [
    { type: "feedbackTunnel", params: { iterations: 6, scale: 0.9, rotation: 7, mix: 0.65 } },
    { type: "kaleidoscope", params: { segments: 6 } },
    { type: "gradientMap", params: { palette: "acid" } } ] },
  { name: "Corrupt Codec", note: "bad motion vectors, stutter, tear", chain: [
    { type: "macroblock", params: { blockSize: 32, amount: 0.3, maxShift: 64, seed: 5 } },
    { type: "sliceStutter", params: { slices: 14, maxHeight: 50, shift: 60, seed: 2 } },
    { type: "vhsTear", params: { amount: 30, bands: 4, jitter: 1, chroma: 3 } },
    { type: "crush", params: { levels: 12, dither: "none" } } ] },
  { name: "Melted Signal", note: "heavy warp, sorted smears, bruise ramp", chain: [
    { type: "warp", params: { amount: 40, frequency: 3, octaves: 3, seed: 11 } },
    { type: "pixelSort", params: { low: 80, high: 230 } },
    { type: "gradientMap", params: { palette: "bruise", mix: 0.7 } } ] },
];
