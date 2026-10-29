import type { CompressionProfile } from "./types";

export interface CompressionSettings {
  label: string;
  summary: string;
  colourResolution: number;
  greyResolution: number;
  monoResolution: number;
  jpegQuality: number;
}

export const COMPRESSION_PROFILES: Record<
  CompressionProfile,
  CompressionSettings
> = {
  light: {
    label: "Light",
    summary: "Prioritises quality with limited image reduction.",
    colourResolution: 220,
    greyResolution: 220,
    monoResolution: 600,
    jpegQuality: 90,
  },
  balanced: {
    label: "Balanced",
    summary: "Suitable for ordinary screens and sharing.",
    colourResolution: 150,
    greyResolution: 150,
    monoResolution: 400,
    jpegQuality: 82,
  },
  smallest: {
    label: "Smallest",
    summary: "Makes images smaller with a clearer quality trade off.",
    colourResolution: 96,
    greyResolution: 96,
    monoResolution: 300,
    jpegQuality: 65,
  },
};

