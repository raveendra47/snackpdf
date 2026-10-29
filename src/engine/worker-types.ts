import type {
  CommandPlan,
  ExecuteOptions,
  InspectDocument,
  WorkerOutput,
  WorkerRequest,
  WorkerResponse,
} from "./types";

export interface GhostscriptModule {
  callMain(args?: string[]): number;
  FS: {
    writeFile(path: string, data: Uint8Array | string): void;
    readFile(path: string, options: { encoding: "binary" }): Uint8Array;
    readdir(path: string): string[];
    unlink(path: string): void;
  };
}

export type {
  CommandPlan,
  ExecuteOptions,
  InspectDocument,
  WorkerOutput,
  WorkerRequest,
  WorkerResponse,
};
