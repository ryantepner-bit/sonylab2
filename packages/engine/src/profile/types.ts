/**
 * Camera profile schema (Phase 3 will populate it). Phase 1 defines ONLY the schema.
 * No camera specifications are included anywhere in this repository yet: they must be
 * researched from primary sources and entered with provenance.
 */
export type Confidence = "measured" | "manufacturer-documented" | "third-party-documented" | "estimated" | "unknown";

export interface Source {
  label: string;
  url?: string;
  accessed?: string; // ISO date
  note?: string;
}

/** Every important parameter carries its own provenance. `value: null` means unknown. */
export interface Sourced<T> {
  value: T | null;
  confidence: Confidence;
  sources: Source[];
  note?: string;
}

export interface CameraProfile {
  schemaVersion: 1;
  id: string; // e.g. "sony-dsc-f717"
  manufacturer: string;
  model: string;
  releaseYear: Sourced<number>;
  sensor: {
    architecture: Sourced<"CCD" | "CMOS">;
    typeDesignation: Sourced<string>; // e.g. "1/1.8-type"
    widthMm: Sourced<number>;
    heightMm: Sourced<number>;
    totalPixels: Sourced<number>;
    effectivePixels: Sourced<number>;
    colorFilterArray: Sourced<string>;
  };
  lens: {
    focalLengthMmMin: Sourced<number>;
    focalLengthMmMax: Sourced<number>;
    equivalent35mmMin: Sourced<number>;
    equivalent35mmMax: Sourced<number>;
    apertureWide: Sourced<number>;
    apertureTele: Sourced<number>;
  };
  processing: {
    isoRange: Sourced<[number, number]>;
    compression: Sourced<string>;
  };
}
