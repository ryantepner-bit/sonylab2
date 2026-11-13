import type { OpDefinition } from "../types";
import { createImage, luma } from "../image";
import { B, R, S } from "./util";

const PALETTES: Record<string, number[][]> = {
  acid: [[0, 0, 0], [40, 0, 90], [220, 0, 120], [255, 230, 0], [255, 255, 255]],
  thermal: [[0, 0, 0], [20, 0, 140], [200, 0, 160], [255, 140, 0], [255, 255, 80], [255, 255, 255]],
  bruise: [[10, 5, 15], [60, 20, 90], [120, 40, 60], [200, 160, 60], [250, 240, 200]],
  phosphor: [[0, 8, 2], [0, 90, 30], [40, 220, 90], [200, 255, 210]],
  cyanotype: [[3, 10, 35], [10, 60, 140], [90, 160, 210], [235, 245, 250]],
};

export const gradientMap: OpDefinition = {
  type: "gradientMap", version: 1, label: "Gradient Map", category: "color", fidelity: "artistic",
  description: "Maps luminance onto a colour ramp (acid, thermal, bruise, phosphor, cyanotype).",
  params: [S("palette", "Palette", Object.keys(PALETTES), "acid"), R("contrast", "Contrast", 0.5, 3, 0.01, 1), B("invert", "Invert ramp", false), R("mix", "Mix", 0, 1, 0.01, 1)],
  run(input, p) {
    const out = createImage(input.width, input.height);
    const stops = PALETTES[String(p.palette)] ?? PALETTES.acid;
    const con = Number(p.contrast), mix = Number(p.mix), inv = Boolean(p.invert);
    const s = input.data, d = out.data;
    for (let i = 0; i < s.length; i += 4) {
      let t = (luma(s[i], s[i + 1], s[i + 2]) / 255 - 0.5) * con + 0.5;
      t = Math.min(1, Math.max(0, t));
      if (inv) t = 1 - t;
      const pos = t * (stops.length - 1), k = Math.min(stops.length - 2, Math.floor(pos)), f = pos - k;
      for (let c = 0; c < 3; c++) {
        const col = stops[k][c] * (1 - f) + stops[k + 1][c] * f;
        d[i + c] = s[i + c] * (1 - mix) + col * mix;
      }
      d[i + 3] = s[i + 3];
    }
    return out;
  },
};
