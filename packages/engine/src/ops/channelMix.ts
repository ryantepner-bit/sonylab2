import type { OpDefinition } from "../types";
import { createImage } from "../image";

const rows = ["r", "g", "b"] as const;
const cols = ["r", "g", "b"] as const;
const params: OpDefinition["params"] = [];
for (const o of rows)
  for (const i of cols)
    params.push({
      kind: "range",
      key: `${o}${i}`,
      label: `out ${o.toUpperCase()} ← in ${i.toUpperCase()}`,
      min: -2,
      max: 2,
      step: 0.01,
      default: o === i ? 1 : 0,
    });

/** 3x3 RGB matrix. The basis for channel leakage / swapped-channel experiments. */
export const channelMix: OpDefinition = {
  type: "channelMix",
  version: 1,
  label: "Channel Mixer",
  category: "color",
  fidelity: "artistic",
  description:
    "Each output channel is a weighted sum of the input channels. Identity = no change. Swapping rows mimics mis-wired channels; off-diagonal terms mimic crosstalk.",
  params,
  run(input, p) {
    const m = (k: string) => Number(p[k]);
    const [rr, rg, rb, gr, gg, gb, br, bg, bb] = ["rr", "rg", "rb", "gr", "gg", "gb", "br", "bg", "bb"].map(m);
    const out = createImage(input.width, input.height);
    const s = input.data;
    const d = out.data;
    for (let i = 0; i < s.length; i += 4) {
      const r = s[i], g = s[i + 1], b = s[i + 2];
      d[i] = rr * r + rg * g + rb * b;
      d[i + 1] = gr * r + gg * g + gb * b;
      d[i + 2] = br * r + bg * g + bb * b;
      d[i + 3] = s[i + 3];
    }
    return out;
  },
};
