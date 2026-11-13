import type { Graph, GraphNode, ImageBuffer, Params } from "./types";
import type { OpRegistry } from "./registry";

export type EvalCache = Map<string, ImageBuffer>;

export interface EvalStats { computed: number; cacheHits: number; }

/** Stable JSON with sorted keys so equal params always produce equal cache keys. */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
}

/** Build a linear chain graph: source -> n1 -> n2 -> ... */
export function chainToGraph(chain: { id: string; type: string; params: Params; bypass?: boolean }[]): Graph {
  const nodes: GraphNode[] = [{ id: "source", type: "source", params: {} }, ...chain];
  const edges = nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id }));
  return { nodes, edges, outputId: nodes[nodes.length - 1].id };
}

/** Throws on cycles, missing nodes, or unsupported fan-in (Phase 1: one input per node). */
export function validateGraph(g: Graph, reg: OpRegistry): void {
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  if (byId.size !== g.nodes.length) throw new Error("Duplicate node ids");
  if (!byId.has(g.outputId)) throw new Error("Output node missing");
  const incoming = new Map<string, string[]>();
  for (const e of g.edges) {
    if (!byId.has(e.from) || !byId.has(e.to)) throw new Error(`Edge references missing node: ${e.from} -> ${e.to}`);
    incoming.set(e.to, [...(incoming.get(e.to) ?? []), e.from]);
  }
  for (const n of g.nodes) {
    if (n.type === "source") continue;
    reg.get(n.type);
    const inc = incoming.get(n.id) ?? [];
    if (inc.length !== 1) throw new Error(`Node ${n.id} must have exactly 1 input (has ${inc.length})`);
  }
  // cycle detection (DFS, colours)
  const state = new Map<string, 1 | 2>();
  const visit = (id: string): void => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) throw new Error(`Cycle detected at node ${id}`);
    state.set(id, 1);
    for (const f of incoming.get(id) ?? []) visit(f);
    state.set(id, 2);
  };
  visit(g.outputId);
}

/**
 * Evaluates the graph with content-addressed caching. A node's cache key is derived from
 * (source key, op type+version, params, bypass, upstream key) so editing one node only
 * recomputes that node and everything downstream.
 */
export function evaluateGraph(
  g: Graph,
  source: ImageBuffer,
  sourceKey: string,
  reg: OpRegistry,
  cache: EvalCache,
  stats: EvalStats = { computed: 0, cacheHits: 0 },
): { image: ImageBuffer; stats: EvalStats; stageKeys: Map<string, string> } {
  validateGraph(g, reg);
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const parent = new Map(g.edges.map((e) => [e.to, e.from]));
  const keys = new Map<string, string>();

  const keyFor = (id: string): string => {
    const cached = keys.get(id);
    if (cached) return cached;
    const n = byId.get(id)!;
    let k: string;
    if (n.type === "source") k = `src:${sourceKey}`;
    else {
      const up = keyFor(parent.get(id)!);
      if (n.bypass) k = up; // bypassed node is transparent: shares upstream key
      else k = `${up}>${n.type}@${reg.get(n.type).version}:${stableStringify(n.params)}`;
    }
    keys.set(id, k);
    return k;
  };

  const run = (id: string): ImageBuffer => {
    const key = keyFor(id);
    const hit = cache.get(key);
    if (hit) { stats.cacheHits++; return hit; }
    const n = byId.get(id)!;
    let out: ImageBuffer;
    if (n.type === "source") out = source;
    else {
      const input = run(parent.get(id)!);
      out = n.bypass ? input : reg.get(n.type).run(input, n.params);
      if (!n.bypass) stats.computed++;
    }
    cache.set(key, out);
    return out;
  };

  return { image: run(g.outputId), stats, stageKeys: keys };
}

/** Evict cache entries not used by the latest evaluation (call after each run to bound memory). */
export function pruneCache(cache: EvalCache, keep: Iterable<string>): void {
  const k = new Set(keep);
  for (const key of [...cache.keys()]) if (!k.has(key)) cache.delete(key);
}
