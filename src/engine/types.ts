export type EngineTool =
  | "compress"
  | "rebuild"
  | "merge"
  | "split"
  | "extract"
  | "remove"
  | "reorder"
  | "pdf-to-jpg"
  | "pdf-to-png"
  | "pdf-to-text"
  | "unlock"
  | "grayscale";

export type CompressionProfile = "light" | "balanced" | "smallest";
export type ImageResolution = 96 | 150 | 300;

export interface ExecuteOptions {
  profile?: CompressionProfile;
  pages?: number[];
  resolution?: ImageResolution;
  password?: string;
}

export interface CommandPlan {
  args: string[];
  outputNames: string[];
  outputPattern?: RegExp;
}

export interface WorkerOutput {
  name: string;
  mimeType: string;
  bytes: ArrayBuffer;
}

export interface InspectDocument {
  pageCount: number;
  pageAreaSquarePoints: number;
  thumbnails: WorkerOutput[];
}

export interface WorkerRequest {
  id: number;
  type: "initialise" | "inspect" | "execute";
  files?: ArrayBuffer[];
  thumbnails?: boolean;
  tool?: EngineTool;
  options?: ExecuteOptions;
}

export type WorkerResponse =
  | { id: number; type: "ready" }
  | { id: number; type: "status"; state: string; page?: number }
  | { id: number; type: "inspected"; documents: InspectDocument[] }
  | { id: number; type: "completed"; outputs: WorkerOutput[] }
  | { id: number; type: "error"; code: string; message: string };
