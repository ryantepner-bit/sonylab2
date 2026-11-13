import type { OpDefinition } from "../types";
import { cloneImage } from "../image";

export const invert: OpDefinition = {
  type: "invert",
  version: 1,
  label: "Invert",
  category: "color",
  fidelity: "artistic",
  description: "Inverts RGB channels (255 - v). Alpha is untouched.",
  params: [],
  run(input) {
    const out = cloneImage(input);
    const d = out.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 255 - d[i];
      d[i + 1] = 255 - d[i + 1];
      d[i + 2] = 255 - d[i + 2];
    }
    return out;
  },
};
