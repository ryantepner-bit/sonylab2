import type { OpDefinition, Params } from "./types";
import { invert } from "./ops/invert";
import { channelMix } from "./ops/channelMix";
import { noise } from "./ops/noise";
import { pixelSort } from "./ops/pixelSort";
import { warp, bulge, kaleidoscope } from "./ops/distort";
import { rgbSplit, crush, vhsTear, macroblock, sliceStutter } from "./ops/degrade";
import { feedbackTunnel } from "./ops/feedback";
import { gradientMap } from "./ops/gradientMap";

export class OpRegistry {
  private ops = new Map<string, OpDefinition>();
  register(op: OpDefinition): this {
    if (this.ops.has(op.type)) throw new Error(`Op already registered: ${op.type}`);
    this.ops.set(op.type, op);
    return this;
  }
  get(type: string): OpDefinition {
    const op = this.ops.get(type);
    if (!op) throw new Error(`Unknown op type: ${type}`);
    return op;
  }
  has(type: string): boolean { return this.ops.has(type); }
  list(): OpDefinition[] { return [...this.ops.values()]; }
  defaultParams(type: string): Params {
    const out: Params = {};
    for (const s of this.get(type).params) out[s.key] = s.default;
    return out;
  }
}

export function createDefaultRegistry(): OpRegistry {
  return [invert, channelMix, noise, pixelSort, warp, bulge, kaleidoscope, rgbSplit, crush, vhsTear, macroblock, sliceStutter, feedbackTunnel, gradientMap]
    .reduce((r, op) => r.register(op), new OpRegistry());
}
