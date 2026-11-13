import type { ParamSpec } from "../types";
export const R = (key: string, label: string, min: number, max: number, step: number, def: number): ParamSpec => ({ kind: "range", key, label, min, max, step, default: def });
export const S = (key: string, label: string, options: string[], def: string): ParamSpec => ({ kind: "select", key, label, options, default: def });
export const B = (key: string, label: string, def: boolean): ParamSpec => ({ kind: "bool", key, label, default: def });
