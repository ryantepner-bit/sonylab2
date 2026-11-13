import type { OpDefinition } from "../types";
import { cloneImage, createImage, sampleBilinear } from "../image";
import { R } from "./util";

export const feedbackTunnel: OpDefinition = {
  type: "feedbackTunnel", version: 1, label: "Feedback Tunnel", category: "feedback", fidelity: "artistic",
  description: "Recursive scale+rotate feedback inside a single frame (video-feedback / droste look). Iterations are capped at 8, so it cannot run away.",
  params: [R("iterations", "Iterations", 0, 8, 1, 5), R("scale", "Scale", 0.6, 1.4, 0.01, 0.9), R("rotation", "Rotation (deg)", -45, 45, 0.5, 6), R("mix", "Feedback mix", 0, 1, 0.01, 0.65), R("cx", "Centre X", 0, 1, 0.01, 0.5), R("cy", "Centre Y", 0, 1, 0.01, 0.5)],
  run(input, p) {
    const { width: w, height: h } = input;
    const n = Math.min(8, Math.max(0, Math.round(Number(p.iterations))));
    if (n === 0) return cloneImage(input);
    const sc = Number(p.scale) || 1, rot = (Number(p.rotation) * Math.PI) / 180, mix = Number(p.mix);
    const cx = Number(p.cx) * w, cy = Number(p.cy) * h, cos = Math.cos(rot), sin = Math.sin(rot);
    let a = cloneImage(input), b = createImage(w, h);
    const tmp = new Uint8ClampedArray(4);
    for (let i = 0; i < n; i++) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dx = (x - cx) / sc, dy = (y - cy) / sc, o = (y * w + x) * 4;
        sampleBilinear(a, cx + dx * cos + dy * sin, cy - dx * sin + dy * cos, tmp, 0, "clamp");
        for (let c = 0; c < 4; c++) b.data[o + c] = input.data[o + c] * (1 - mix) + tmp[c] * mix;
      }
      [a, b] = [b, a];
    }
    return a;
  },
};
