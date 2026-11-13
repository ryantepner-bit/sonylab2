import type { OpDefinition } from "../types";
import { cloneImage } from "../image";
import { mulberry32 } from "../rng";

/** Placeholder-free but simple: additive uniform noise. The physical sensor model (shot/read noise) arrives in Phase 5. */
export const noise: OpDefinition = {
  type: "noise",
  version: 1,
  label: "Additive Noise",
  category: "degradation",
  fidelity: "artistic",
  description:
    "Adds uniform random noise in display-encoded space. NOT a sensor noise model (no shot-noise signal dependence); that comes with the sensor stage.",
  params: [
    { kind: "range", key: "amount", label: "Amount", min: 0, max: 128, step: 1, default: 24 },
    { kind: "bool", key: "mono", label: "Monochrome noise", default: true },
    { kind: "range", key: "seed", label: "Seed", min: 0, max: 9999, step: 1, default: 1 },
  ],
  run(input, p) {
    const out = cloneImage(input);
    const rnd = mulberry32(Number(p.seed));
    const amt = Number(p.amount);
    const mono = Boolean(p.mono);
    const d = out.data;
    for (let i = 0; i < d.length; i += 4) {
      const n0 = (rnd() * 2 - 1) * amt;
      d[i] += n0;
      d[i + 1] += mono ? n0 : (rnd() * 2 - 1) * amt;
      d[i + 2] += mono ? n0 : (rnd() * 2 - 1) * amt;
    }
    return out;
  },
};
