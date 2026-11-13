import type { Graph } from "./types";

export const PROJECT_FORMAT = "sonylab-project";
export const PROJECT_VERSION = 1;

export interface ProjectFile {
  format: typeof PROJECT_FORMAT;
  version: number;
  name: string;
  savedAt: string;
  /** Original image is stored separately (by reference) so it is never modified. */
  source: { fileName: string; width: number; height: number } | null;
  graph: Graph;
}

type Migration = (raw: any) => any;
/** migrations[n] upgrades a version-n file to version n+1. */
const migrations: Record<number, Migration> = {};

export function serializeProject(p: Omit<ProjectFile, "format" | "version">): string {
  const file: ProjectFile = { format: PROJECT_FORMAT, version: PROJECT_VERSION, ...p };
  return JSON.stringify(file, null, 2);
}

export function parseProject(text: string): ProjectFile {
  let raw: any;
  try { raw = JSON.parse(text); } catch { throw new Error("Project file is not valid JSON"); }
  if (!raw || raw.format !== PROJECT_FORMAT) throw new Error("Not a SonyLab project file");
  if (typeof raw.version !== "number") throw new Error("Project file has no version");
  if (raw.version > PROJECT_VERSION) throw new Error(`Project version ${raw.version} is newer than this app supports (${PROJECT_VERSION})`);
  while (raw.version < PROJECT_VERSION) {
    const m = migrations[raw.version];
    if (!m) throw new Error(`No migration from project version ${raw.version}`);
    raw = m(raw);
  }
  if (!raw.graph || !Array.isArray(raw.graph.nodes)) throw new Error("Project graph is missing or malformed");
  return raw as ProjectFile;
}
