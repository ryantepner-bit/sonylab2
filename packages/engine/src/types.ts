/**
 * Core engine types. The engine has NO dependency on React, the DOM, or WebGL:
 * it runs identically in a Web Worker, in Node (tests) and, later, in Tauri.
 */

/** Phase 1 pixel container: 8-bit RGBA, non-premultiplied, row-major. */
export interface ImageBuffer {
  width: number;
  height: number;
  data: Uint8ClampedArray; // length = width * height * 4
}

export type ParamValue = number | string | boolean;
export type Params = Record<string, ParamValue>;

export type ParamSpec =
  | { kind: "range"; key: string; label: string; min: number; max: number; step: number; default: number }
  | { kind: "select"; key: string; label: string; options: string[]; default: string }
  | { kind: "bool"; key: string; label: string; default: boolean };

export type OpCategory = "color" | "degradation" | "sorting" | "mirroring" | "optics" | "sensor" | "signal" | "dsp" | "distortion" | "feedback";

/** How faithful an operation is to real-world behaviour. Surfaced in the UI (Module 4 / 11). */
export type Fidelity = "artistic" | "physically-motivated" | "validated";

export interface OpDefinition {
  type: string;
  version: number;
  label: string;
  category: OpCategory;
  fidelity: Fidelity;
  /** Plain-language explanation of the phenomenon (or the artistic intent). */
  description: string;
  params: ParamSpec[];
  /** Pure function: must never mutate `input`. Returns a new buffer. */
  run(input: ImageBuffer, params: Params): ImageBuffer;
}

export interface GraphNode {
  id: string;
  type: string; // "source" or a registered op type
  params: Params;
  bypass?: boolean;
}
export interface GraphEdge {
  from: string;
  to: string;
}
export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  outputId: string;
}
