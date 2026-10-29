import type {
  EngineTool,
  ExecuteOptions,
  InspectDocument,
  WorkerOutput,
  WorkerRequest,
  WorkerResponse,
} from "../../src/engine/types";

interface PendingRequest {
  resolve(value: WorkerResponse): void;
  reject(error: Error): void;
  onStatus?: (state: string, page?: number) => void;
}

export class LocalEngine {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private readyPromise: Promise<void> | null = null;
  private disposed = false;

  private createWorker(): Worker {
    const worker = new Worker("/engine/worker.js", { type: "module", name: "snackpdf-engine" });
    worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      if (message.type === "status") {
        pending.onStatus?.(message.state, message.page);
        return;
      }
      this.pending.delete(message.id);
      if (message.type === "error") {
        const error = new Error(message.message);
        error.name = message.code;
        pending.reject(error);
      } else {
        pending.resolve(message);
      }
    });
    worker.addEventListener("error", () => {
      this.failPending(new Error("The local PDF engine stopped unexpectedly."));
      this.worker?.terminate();
      this.worker = null;
      this.readyPromise = null;
    });
    return worker;
  }

  private getWorker(): Worker {
    if (this.disposed) {
      const error = new Error("The operation was cancelled.");
      error.name = "cancelled";
      throw error;
    }
    if (!this.worker) this.worker = this.createWorker();
    return this.worker;
  }

  private request(
    request: Omit<WorkerRequest, "id">,
    transfer: Transferable[] = [],
    onStatus?: (state: string, page?: number) => void,
  ): Promise<WorkerResponse> {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onStatus });
      this.getWorker().postMessage({ ...request, id } satisfies WorkerRequest, transfer);
    });
  }

  async initialise(onStatus?: (state: string) => void): Promise<void> {
    if (!this.readyPromise) {
      this.readyPromise = this.request(
        { type: "initialise" },
        [],
        (state) => onStatus?.(state),
      ).then((message) => {
        if (message.type !== "ready") throw new Error("The local PDF engine could not start.");
      }).catch((error) => {
        this.readyPromise = null;
        throw error;
      });
    }
    return this.readyPromise;
  }

  async inspect(
    buffers: ArrayBuffer[],
    thumbnails: boolean,
    onStatus?: (state: string, page?: number) => void,
  ): Promise<InspectDocument[]> {
    await this.initialise((state) => onStatus?.(state));
    const response = await this.request(
      { type: "inspect", files: buffers, thumbnails },
      buffers,
      onStatus,
    );
    if (response.type !== "inspected") throw new Error("The PDF could not be inspected.");
    return response.documents;
  }

  async execute(
    tool: EngineTool,
    buffers: ArrayBuffer[],
    options: ExecuteOptions,
    onStatus?: (state: string, page?: number) => void,
  ): Promise<WorkerOutput[]> {
    await this.initialise((state) => onStatus?.(state));
    const response = await this.request(
      { type: "execute", tool, files: buffers, options },
      buffers,
      onStatus,
    );
    if (response.type !== "completed") throw new Error("The resulting file could not be created.");
    return response.outputs;
  }

  cancel(): void {
    const error = new Error("The operation was cancelled.");
    error.name = "cancelled";
    this.failPending(error);
    this.worker?.terminate();
    this.worker = null;
    this.readyPromise = null;
  }

  dispose(): void {
    this.disposed = true;
    this.cancel();
  }

  private failPending(error: Error): void {
    for (const request of this.pending.values()) request.reject(error);
    this.pending.clear();
  }
}
