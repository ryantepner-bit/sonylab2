import { describe, it, expect } from "vitest";
import { createDefaultRegistry, chainToGraph, evaluateGraph, validateGraph, parseProject, serializeProject } from "../src";
import type { ImageBuffer, Graph } from "../src";

const reg = createDefaultRegistry();

function img(w: number, h: number, f: (x: number, y: number) => [number, number, number]): ImageBuffer {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b] = f(x, y); const i = (y * w + x) * 4;
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
  }
  return { width: w, height: h, data };
}
const node = (id: string, type: string, over = {}) => ({ id, type, params: { ...reg.defaultParams(type), ...over } });

describe("invert", () => {
  it("is an involution and does not mutate input", () => {
    const src = img(4, 4, (x, y) => [x * 40, y * 40, 7]);
    const copy = new Uint8ClampedArray(src.data);
    const once = reg.get("invert").run(src, {});
    const twice = reg.get("invert").run(once, {});
    expect([...src.data]).toEqual([...copy]);
    expect([...twice.data]).toEqual([...src.data]);
  });
});

describe("channelMix", () => {
  it("identity leaves pixels unchanged", () => {
    const src = img(3, 3, (x, y) => [x * 50, y * 50, 99]);
    const out = reg.get("channelMix").run(src, reg.defaultParams("channelMix"));
    expect([...out.data]).toEqual([...src.data]);
  });
  it("can swap R and B", () => {
    const src = img(1, 1, () => [10, 20, 30]);
    const p = { ...reg.defaultParams("channelMix"), rr: 0, rb: 1, bb: 0, br: 1 };
    const out = reg.get("channelMix").run(src, p);
    expect([...out.data]).toEqual([30, 20, 10, 255]);
  });
});

describe("noise", () => {
  it("is deterministic for a given seed and differs across seeds", () => {
    const src = img(8, 8, () => [128, 128, 128]);
    const a = reg.get("noise").run(src, { ...reg.defaultParams("noise"), seed: 5 });
    const b = reg.get("noise").run(src, { ...reg.defaultParams("noise"), seed: 5 });
    const c = reg.get("noise").run(src, { ...reg.defaultParams("noise"), seed: 6 });
    expect([...a.data]).toEqual([...b.data]);
    expect([...a.data]).not.toEqual([...c.data]);
  });
  it("amount 0 is identity", () => {
    const src = img(4, 4, (x) => [x * 30, 5, 9]);
    const out = reg.get("noise").run(src, { ...reg.defaultParams("noise"), amount: 0 });
    expect([...out.data]).toEqual([...src.data]);
  });
});

describe("pixelSort", () => {
  const p = reg.defaultParams("pixelSort");
  it("sorts a row ascending by luminance within the threshold window", () => {
    const vals = [200, 50, 150, 100];
    const src = img(4, 1, (x) => [vals[x], vals[x], vals[x]]);
    const out = reg.get("pixelSort").run(src, { ...p, low: 0, high: 255 });
    expect([out.data[0], out.data[4], out.data[8], out.data[12]]).toEqual([50, 100, 150, 200]);
  });
  it("leaves pixels outside the window in place and splits intervals there", () => {
    const vals = [200, 100, 5, 150, 120];
    const src = img(5, 1, (x) => [vals[x], vals[x], vals[x]]);
    const out = reg.get("pixelSort").run(src, { ...p, low: 20, high: 255 });
    expect([0, 1, 2, 3, 4].map((x) => out.data[x * 4])).toEqual([100, 200, 5, 120, 150]);
  });
  it("preserves the multiset of pixels (vertical)", () => {
    const src = img(5, 6, (x, y) => [(x * 37 + y * 11) % 256, (x * 5) % 256, (y * 91) % 256]);
    const out = reg.get("pixelSort").run(src, { ...p, direction: "vertical", low: 0, high: 255 });
    const bag = (b: ImageBuffer) => { const s: string[] = []; for (let i = 0; i < b.data.length; i += 4) s.push(`${b.data[i]},${b.data[i + 1]},${b.data[i + 2]}`); return s.sort(); };
    expect(bag(out)).toEqual(bag(src));
  });
  it("descending reverses order", () => {
    const vals = [10, 30, 20];
    const src = img(3, 1, (x) => [vals[x], vals[x], vals[x]]);
    const out = reg.get("pixelSort").run(src, { ...p, low: 0, high: 255, reverse: true });
    expect([out.data[0], out.data[4], out.data[8]]).toEqual([30, 20, 10]);
  });
});

describe("graph", () => {
  const src = img(6, 6, (x, y) => [x * 40, y * 40, 100]);

  it("evaluates a chain and caches unchanged prefixes", () => {
    const cache = new Map();
    const g1 = chainToGraph([node("a", "invert"), node("b", "noise")]);
    const r1 = evaluateGraph(g1, src, "s1", reg, cache);
    expect(r1.stats.computed).toBe(2);
    const g2 = chainToGraph([node("a", "invert"), node("b", "noise", { amount: 50 })]);
    const r2 = evaluateGraph(g2, src, "s1", reg, cache);
    expect(r2.stats.computed).toBe(1); // only the edited node recomputes
    expect(r2.stats.cacheHits).toBeGreaterThanOrEqual(1);
  });

  it("bypass makes a node transparent", () => {
    const g = chainToGraph([{ ...node("a", "invert"), bypass: true }]);
    const r = evaluateGraph(g, src, "s1", reg, new Map());
    expect([...r.image.data]).toEqual([...src.data]);
  });

  it("rejects cycles", () => {
    const g: Graph = {
      nodes: [{ id: "source", type: "source", params: {} }, node("a", "invert"), node("b", "invert")],
      edges: [{ from: "b", to: "a" }, { from: "a", to: "b" }],
      outputId: "b",
    };
    expect(() => validateGraph(g, reg)).toThrow(/Cycle/);
  });

  it("rejects unknown op types", () => {
    const g = chainToGraph([{ id: "x", type: "doesNotExist", params: {} }]);
    expect(() => validateGraph(g, reg)).toThrow(/Unknown op/);
  });
});

describe("project file", () => {
  it("round-trips", () => {
    const graph = chainToGraph([node("a", "invert")]);
    const text = serializeProject({ name: "t", savedAt: "2026-01-01T00:00:00Z", source: null, graph });
    const back = parseProject(text);
    expect(back.graph).toEqual(graph);
    expect(back.version).toBe(1);
  });
  it("rejects newer versions and garbage", () => {
    expect(() => parseProject("{")).toThrow();
    expect(() => parseProject(JSON.stringify({ format: "sonylab-project", version: 99, graph: { nodes: [] } }))).toThrow(/newer/);
    expect(() => parseProject(JSON.stringify({ format: "nope" }))).toThrow();
  });
});
