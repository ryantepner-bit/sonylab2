import type { OpDefinition } from "../types";
import { cloneImage, createImage, sampleBilinear, wrapIndex } from "../image";
import { mulberry32 } from "../rng";
import { R, S } from "./util";

export const rgbSplit: OpDefinition = {
  type: "rgbSplit", version: 1, label: "RGB Split", category: "degradation", fidelity: "artistic",
  description: "Offsets red and blue against green. 'radial' grows toward the corners like lateral chromatic aberration (a crude approximation of it, not a lens model); 'linear' is a constant misregistration.",
  params: [S("mode", "Mode", ["linear", "radial"], "linear"), R("amount", "Amount (px)", -80, 80, 0.25, 6), R("angle", "Angle (linear)", 0, 360, 1, 0)],
  run(input, p) {
    const { width: w, height: h } = input;
    const out = createImage(w, h);
    const amt = Number(p.amount), ang = (Number(p.angle) * Math.PI) / 180, radial = p.mode === "radial";
    const ux = Math.cos(ang), uy = Math.sin(ang), cx = w / 2, cy = h / 2, k = amt / Math.max(1, Math.hypot(cx, cy));
    const tmp = new Uint8ClampedArray(4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ox = radial ? (x - cx) * k : ux * amt, oy = radial ? (y - cy) * k : uy * amt;
      const o = (y * w + x) * 4;
      sampleBilinear(input, x - ox, y - oy, tmp, 0); out.data[o] = tmp[0];
      out.data[o + 1] = input.data[o + 1];
      sampleBilinear(input, x + ox, y + oy, tmp, 0); out.data[o + 2] = tmp[2];
      out.data[o + 3] = input.data[o + 3];
    }
    return out;
  },
};

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const crush: OpDefinition = {
  type: "crush", version: 1, label: "Bit Crush + Dither", category: "degradation", fidelity: "artistic",
  description: "Reduces levels per channel, optionally pixelates, and dithers (ordered Bayer 4x4 or noise) to hide or exaggerate banding.",
  params: [R("levels", "Levels / channel", 2, 32, 1, 5), S("dither", "Dither", ["none", "bayer4", "noise"], "bayer4"), R("pixelSize", "Pixel size", 1, 32, 1, 1), R("seed", "Seed", 0, 9999, 1, 1)],
  run(input, p) {
    const { width: w, height: h } = input;
    const out = createImage(w, h);
    const lv = Math.max(2, Math.round(Number(p.levels))), step = 255 / (lv - 1);
    const ps = Math.max(1, Math.round(Number(p.pixelSize))), mode = String(p.dither), rnd = mulberry32(Number(p.seed));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const sx = Math.min(w - 1, Math.floor(x / ps) * ps), sy = Math.min(h - 1, Math.floor(y / ps) * ps);
      const i = (sy * w + sx) * 4, o = (y * w + x) * 4;
      const t = mode === "bayer4" ? ((BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16 - 0.5) * step : mode === "noise" ? (rnd() - 0.5) * step : 0;
      for (let c = 0; c < 3; c++) out.data[o + c] = Math.round((input.data[i + c] + t) / step) * step;
      out.data[o + 3] = input.data[i + 3];
    }
    return out;
  },
};

export const vhsTear: OpDefinition = {
  type: "vhsTear", version: 1, label: "Tracking Tear", category: "degradation", fidelity: "physically-motivated",
  description: "Per-line horizontal timing error plus tear bands and chroma misregistration, like a failing tape/analog line-timing path. The pattern is synthetic (seeded), but the mechanism (row-wise timing offsets) is real.",
  params: [R("amount", "Tear (px)", 0, 300, 1, 60), R("bands", "Bands", 0, 40, 1, 8), R("jitter", "Line jitter (px)", 0, 12, 0.1, 2), R("chroma", "Chroma bleed (px)", 0, 30, 1, 5), R("seed", "Seed", 0, 9999, 1, 1)],
  run(input, p) {
    const { width: w, height: h } = input;
    const out = createImage(w, h);
    const rnd = mulberry32(Number(p.seed));
    const jitter = Number(p.jitter), amount = Number(p.amount), cb = Math.round(Number(p.chroma));
    const shift = new Float32Array(h);
    for (let y = 0; y < h; y++) shift[y] = (rnd() * 2 - 1) * jitter;
    const bands = Math.round(Number(p.bands));
    for (let b = 0; b < bands; b++) {
      const c = rnd() * h, bh = 2 + rnd() * Math.max(2, h / 12), off = (rnd() * 2 - 1) * amount;
      for (let y = Math.max(0, Math.floor(c - bh)); y <= Math.min(h - 1, Math.ceil(c + bh)); y++) {
        const f = 1 - Math.abs(y - c) / bh;
        if (f > 0) shift[y] += off * f;
      }
    }
    const s = input.data, d = out.data;
    for (let y = 0; y < h; y++) {
      const sh = Math.round(shift[y]), base = y * w * 4;
      for (let x = 0; x < w; x++) {
        const o = base + x * 4;
        const xg = wrapIndex(x - sh, w);
        d[o] = s[base + wrapIndex(x - sh - cb, w) * 4];
        d[o + 1] = s[base + xg * 4 + 1];
        d[o + 2] = s[base + wrapIndex(x - sh + cb, w) * 4 + 2];
        d[o + 3] = s[base + xg * 4 + 3];
      }
    }
    return out;
  },
};

export const macroblock: OpDefinition = {
  type: "macroblock", version: 1, label: "Macroblock Drift", category: "degradation", fidelity: "physically-motivated",
  description: "Replaces random blocks with pixels from a displaced position, like corrupted motion vectors in a video/JPEG decoder. Block corruption is real codec behaviour; the random pattern is synthetic.",
  params: [R("blockSize", "Block size", 4, 128, 1, 32), R("amount", "Blocks affected", 0, 1, 0.01, 0.25), R("maxShift", "Max shift (px)", 0, 300, 1, 48), R("seed", "Seed", 0, 9999, 1, 1)],
  run(input, p) {
    const { width: w, height: h } = input;
    const out = cloneImage(input);
    const bs = Math.max(2, Math.round(Number(p.blockSize))), amount = Number(p.amount), ms = Number(p.maxShift), rnd = mulberry32(Number(p.seed));
    for (let by = 0; by < h; by += bs) for (let bx = 0; bx < w; bx += bs) {
      const r1 = rnd(), r2 = rnd(), r3 = rnd();
      if (r1 >= amount) continue;
      const dx = Math.round((r2 * 2 - 1) * ms), dy = Math.round((r3 * 2 - 1) * ms);
      for (let yy = by; yy < Math.min(by + bs, h); yy++) {
        const sy = Math.min(h - 1, Math.max(0, yy + dy));
        for (let xx = bx; xx < Math.min(bx + bs, w); xx++) {
          const sx = Math.min(w - 1, Math.max(0, xx + dx));
          const o = (yy * w + xx) * 4, i = (sy * w + sx) * 4;
          out.data[o] = input.data[i]; out.data[o + 1] = input.data[i + 1]; out.data[o + 2] = input.data[i + 2]; out.data[o + 3] = input.data[i + 3];
        }
      }
    }
    return out;
  },
};

export const sliceStutter: OpDefinition = {
  type: "sliceStutter", version: 1, label: "Slice Stutter", category: "degradation", fidelity: "artistic",
  description: "Overwrites random horizontal strips with copies of other strips (optionally shifted) — a repeat/stutter glitch.",
  params: [R("slices", "Slices", 0, 80, 1, 12), R("maxHeight", "Max strip height", 2, 300, 1, 40), R("shift", "Max shift (px)", 0, 300, 1, 40), R("seed", "Seed", 0, 9999, 1, 1)],
  run(input, p) {
    const { width: w, height: h } = input;
    const out = cloneImage(input);
    const n = Math.round(Number(p.slices)), mh = Number(p.maxHeight), ms = Number(p.shift), rnd = mulberry32(Number(p.seed));
    for (let k = 0; k < n; k++) {
      const y0 = Math.floor(rnd() * h), hh = 1 + Math.floor(rnd() * mh), sy = Math.floor(rnd() * h), dx = Math.round((rnd() * 2 - 1) * ms);
      for (let r = 0; r < hh && y0 + r < h; r++) {
        const sr = Math.min(h - 1, sy + r);
        for (let x = 0; x < w; x++) {
          const o = ((y0 + r) * w + x) * 4, i = (sr * w + wrapIndex(x + dx, w)) * 4;
          out.data[o] = input.data[i]; out.data[o + 1] = input.data[i + 1]; out.data[o + 2] = input.data[i + 2]; out.data[o + 3] = input.data[i + 3];
        }
      }
    }
    return out;
  },
};
