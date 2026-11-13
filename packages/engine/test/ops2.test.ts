import { describe, it, expect } from "vitest";
import { createDefaultRegistry } from "../src";
import type { ImageBuffer } from "../src";

const reg = createDefaultRegistry();
function img(w: number, h: number, f: (x: number, y: number) => [number, number, number]): ImageBuffer {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, g, b] = f(x, y); const i = (y * w + x) * 4; data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255; }
  return { width: w, height: h, data };
}
const photo = img(24, 20, (x, y) => [(x * 11 + y * 3) % 256, (x * 5 + y * 17) % 256, (x * y) % 256]);
const run = (type: string, over: Record<string, number | string | boolean> = {}, src = photo) => reg.get(type).run(src, { ...reg.defaultParams(type), ...over });
const same = (a: ImageBuffer, b: ImageBuffer) => expect([...a.data]).toEqual([...b.data]);

describe("neutral settings are identity", () => {
  it("warp amount 0", () => same(run("warp", { amount: 0 }), photo));
  it("bulge strength 0", () => same(run("bulge", { strength: 0 }), photo));
  it("rgbSplit amount 0", () => same(run("rgbSplit", { amount: 0 }), photo));
  it("vhsTear all zero", () => same(run("vhsTear", { amount: 0, jitter: 0, chroma: 0 }), photo));
  it("macroblock amount 0", () => same(run("macroblock", { amount: 0 }), photo));
  it("sliceStutter 0 slices", () => same(run("sliceStutter", { slices: 0 }), photo));
  it("feedbackTunnel 0 iterations", () => same(run("feedbackTunnel", { iterations: 0 }), photo));
  it("gradientMap mix 0", () => same(run("gradientMap", { mix: 0 }), photo));
});

describe("behaviour", () => {
  it("every new op keeps dimensions, is deterministic, and does not mutate input", () => {
    const before = new Uint8ClampedArray(photo.data);
    for (const t of ["warp", "bulge", "kaleidoscope", "rgbSplit", "crush", "vhsTear", "macroblock", "sliceStutter", "feedbackTunnel", "gradientMap"]) {
      const a = run(t), b = run(t);
      expect([a.width, a.height]).toEqual([photo.width, photo.height]);
      same(a, b);
    }
    expect([...photo.data]).toEqual([...before]);
  });
  it("rgbSplit linear moves red by +amount along x", () => {
    const src = img(8, 1, (x) => [x * 10, 50, 50]);
    const out = run("rgbSplit", { mode: "linear", amount: 4, angle: 0 }, src);
    expect(out.data[5 * 4]).toBe(10); // red at x=5 came from x=1
    expect(out.data[5 * 4 + 1]).toBe(50);
  });
  it("crush with 2 levels and no dither yields only 0/255", () => {
    const out = run("crush", { levels: 2, dither: "none" });
    for (let i = 0; i < out.data.length; i += 4) for (let c = 0; c < 3; c++) expect([0, 255].includes(out.data[i + c])).toBe(true);
  });
  it("bulge leaves pixels outside the radius untouched", () => {
    const out = run("bulge", { radius: 0.2, strength: 0.9, cx: 0.5, cy: 0.5 });
    expect([out.data[0], out.data[1], out.data[2]]).toEqual([photo.data[0], photo.data[1], photo.data[2]]);
  });
  it("gradientMap maps black and white to the ramp ends", () => {
    const src = img(2, 1, (x) => (x === 0 ? [0, 0, 0] : [255, 255, 255]));
    const out = run("gradientMap", { palette: "acid" }, src);
    expect([out.data[0], out.data[1], out.data[2]]).toEqual([0, 0, 0]);
    expect([out.data[4], out.data[5], out.data[6]]).toEqual([255, 255, 255]);
  });
  it("different seeds change stochastic ops", () => {
    const a = run("macroblock", { amount: 1, seed: 1 }), b = run("macroblock", { amount: 1, seed: 2 });
    expect([...a.data]).not.toEqual([...b.data]);
  });
  it("kaleidoscope with mirror symmetry: 2 segments is symmetric about the axis through the centre", () => {
    const out = run("kaleidoscope", { segments: 2, rotation: 0, cx: 0.5, cy: 0.5 }, img(21, 21, (x, y) => [x * 12, y * 12, 9]));
    const px = (x: number, y: number) => out.data[(y * 21 + x) * 4];
    expect(px(15, 14)).toBe(px(15, 6)); // mirror across y = 10
  });
});
