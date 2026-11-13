import type { OpDefinition } from "../types";
import { createImage, sampleBilinear } from "../image";
import { mulberry32 } from "../rng";
import { R } from "./util";

const TAU = Math.PI * 2;

export const warp: OpDefinition = {
  type: "warp", version: 1, label: "Liquid Warp", category: "distortion", fidelity: "artistic",
  description: "Multi-octave sinusoidal domain warp with cross-coupled axes. Faces and edges ripple and melt. Seeded and deterministic.",
  params: [R("amount", "Amount (px)", 0, 120, 0.5, 18), R("frequency", "Frequency", 0.25, 16, 0.25, 3), R("octaves", "Octaves", 1, 4, 1, 2), R("seed", "Seed", 0, 9999, 1, 1)],
  run(input, p) {
    const { width: w, height: h } = input;
    const out = createImage(w, h);
    const rnd = mulberry32(Number(p.seed));
    const oct = Math.round(Number(p.octaves));
    const ph: number[][] = [];
    for (let k = 0; k < oct; k++) ph.push([rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU]);
    const amount = Number(p.amount), f0 = Number(p.frequency);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let dx = 0, dy = 0;
      for (let k = 0; k < oct; k++) {
        const f = f0 * 2 ** k, a = amount / 2 ** k, q = ph[k];
        dx += a * Math.sin(TAU * f * (y / h) + q[0] + 0.7 * Math.sin(TAU * f * 0.5 * (x / w) + q[1]));
        dy += a * Math.sin(TAU * f * (x / w) + q[2] + 0.7 * Math.sin(TAU * f * 0.5 * (y / h) + q[3]));
      }
      sampleBilinear(input, x + dx, y + dy, out.data, (y * w + x) * 4, "clamp");
    }
    return out;
  },
};

export const bulge: OpDefinition = {
  type: "bulge", version: 1, label: "Bulge / Pinch", category: "distortion", fidelity: "artistic",
  description: "Radial lens-style distortion around a centre. Positive strength swells the centre (grotesque portrait look), negative pinches it.",
  params: [R("cx", "Centre X", 0, 1, 0.01, 0.5), R("cy", "Centre Y", 0, 1, 0.01, 0.5), R("radius", "Radius", 0.05, 1.5, 0.01, 0.6), R("strength", "Strength", -1, 1, 0.01, 0.7)],
  run(input, p) {
    const { width: w, height: h } = input;
    const out = createImage(w, h);
    const cx = Number(p.cx) * w, cy = Number(p.cy) * h;
    const rad = Math.max(1, Number(p.radius) * Math.min(w, h));
    const s = Number(p.strength);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy);
      if (r >= rad || s === 0) { out.data[o] = input.data[o]; out.data[o + 1] = input.data[o + 1]; out.data[o + 2] = input.data[o + 2]; out.data[o + 3] = input.data[o + 3]; continue; }
      const t = r / rad;
      const f = 1 - s * (1 - t) * (1 - t);
      sampleBilinear(input, cx + dx * f, cy + dy * f, out.data, o, "clamp");
    }
    return out;
  },
};

export const kaleidoscope: OpDefinition = {
  type: "kaleidoscope", version: 1, label: "Kaleidoscope", category: "mirroring", fidelity: "artistic",
  description: "Folds the image into N mirrored wedges around an adjustable centre (radial symmetry).",
  params: [R("segments", "Segments", 2, 24, 1, 6), R("cx", "Centre X", 0, 1, 0.01, 0.5), R("cy", "Centre Y", 0, 1, 0.01, 0.5), R("rotation", "Rotation", 0, 360, 1, 0), R("zoom", "Zoom", 0.25, 4, 0.01, 1)],
  run(input, p) {
    const { width: w, height: h } = input;
    const out = createImage(w, h);
    const cx = Number(p.cx) * w, cy = Number(p.cy) * h;
    const n = Math.max(2, Math.round(Number(p.segments)));
    const seg = TAU / n, rot = (Number(p.rotation) * Math.PI) / 180, zoom = Number(p.zoom);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = x - cx, dy = y - cy;
      const r = Math.hypot(dx, dy) / zoom;
      let a = Math.atan2(dy, dx) - rot;
      a = ((a % seg) + seg) % seg;
      if (a > seg / 2) a = seg - a;
      a += rot;
      sampleBilinear(input, cx + r * Math.cos(a), cy + r * Math.sin(a), out.data, (y * w + x) * 4, "mirror");
    }
    return out;
  },
};

