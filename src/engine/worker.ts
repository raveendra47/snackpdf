import {
  buildCommand,
  buildCountCommand,
  buildSplitCommand,
  buildThumbnailCommand,
  inputName,
} from "./commands";
import { EngineError, mapEngineFailure, publicMessage } from "./errors";
import type {
  CommandPlan,
  ExecuteOptions,
  GhostscriptModule,
  InspectDocument,
  WorkerOutput,
  WorkerRequest,
  WorkerResponse,
} from "./worker-types";

let wasmBinary: Uint8Array | null = null;
let busy = false;

function reply(message: WorkerResponse, transfer: Transferable[] = []): void {
  self.postMessage(message, { transfer });
}

function mimeType(name: string): string {
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".jpg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".txt")) return "text/plain;charset=utf-8";
  return "application/octet-stream";
}

function assertPdfSignature(buffer: ArrayBuffer): void {
  const head = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 1024));
  let signature = "";
  for (const byte of head) signature += String.fromCharCode(byte);
  if (!signature.includes("%PDF-")) {
    throw new EngineError("invalid-pdf", publicMessage("invalid-pdf"));
  }
}

async function initialise(): Promise<void> {
  if (wasmBinary) return;
  const response = await fetch("/engine/gs.wasm", {
    cache: "force-cache",
    credentials: "same-origin",
  });
  if (!response.ok) throw new EngineError("engine-failed", publicMessage("engine-failed"));
  wasmBinary = new Uint8Array(await response.arrayBuffer());
}

async function createModule(
  output: string[],
  id: number,
): Promise<GhostscriptModule> {
  await initialise();
  const engineUrl = new URL("/engine/gs.js", self.location.origin).href;
  const imported = (await import(engineUrl)) as {
    default: (options: Record<string, unknown>) => Promise<GhostscriptModule>;
  };
  return imported.default({
    wasmBinary,
    noExitRuntime: true,
    print: (line: unknown) => {
      const text = String(line);
      output.push(text);
      const match = /^Page\s+(\d+)/.exec(text);
      if (match) reply({ id, type: "status", state: "processing", page: Number(match[1]) });
    },
    printErr: (line: unknown) => output.push(String(line)),
  });
}

function collectOutputs(engineInstance: GhostscriptModule, plan: CommandPlan): WorkerOutput[] {
  const names = plan.outputPattern
    ? engineInstance.FS.readdir("/").filter((name) => plan.outputPattern?.test(name)).sort()
    : plan.outputNames;
  if (!names.length) throw new EngineError("no-output", publicMessage("no-output"));
  return names.map((name) => {
    const source = engineInstance.FS.readFile(name, { encoding: "binary" }) as Uint8Array;
    const copy = source.slice();
    return { name, mimeType: mimeType(name), bytes: copy.buffer };
  });
}

async function runPlan(
  id: number,
  files: ArrayBuffer[],
  plan: CommandPlan,
): Promise<WorkerOutput[]> {
  const logs: string[] = [];
  let engineInstance: GhostscriptModule | null = null;
  try {
    files.forEach(assertPdfSignature);
    engineInstance = await createModule(logs, id);
    files.forEach((buffer, index) => {
      engineInstance?.FS.writeFile(inputName(index), new Uint8Array(buffer));
    });
    const status = engineInstance.callMain([...plan.args]);
    if (status !== 0) throw mapEngineFailure(logs.join("\n"));
    return collectOutputs(engineInstance, plan);
  } catch (error) {
    if (error instanceof EngineError) throw error;
    throw mapEngineFailure(`${logs.join("\n")}\n${String(error)}`);
  } finally {
    if (engineInstance) {
      for (const name of engineInstance.FS.readdir("/")) {
        if (name.startsWith("input-") || name.startsWith("output") || name.startsWith("page-") || name.startsWith("thumb-")) {
          try {
            engineInstance.FS.unlink(name);
          } catch {
            // The in-memory filesystem is discarded with this module.
          }
        }
      }
    }
    engineInstance = null;
  }
}

async function inspectOne(
  id: number,
  file: ArrayBuffer,
  thumbnails: boolean,
): Promise<InspectDocument> {
  assertPdfSignature(file);
  const logs: string[] = [];
  let engineInstance: GhostscriptModule | null = null;
  let pageAreaSquarePoints = 0;
  try {
    engineInstance = await createModule(logs, id);
    engineInstance.FS.writeFile(inputName(0), new Uint8Array(file));
    const status = engineInstance.callMain(buildCountCommand());
    if (status !== 0) throw mapEngineFailure(logs.join("\n"));
    const pageCount = Number(logs.findLast((line) => /^\d+$/.test(line.trim()))?.trim());
    if (!Number.isSafeInteger(pageCount) || pageCount < 1) {
      throw mapEngineFailure(logs.join("\n"));
    }
    const mediaBoxes = logs.flatMap((line) => {
      const match = /^\[\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\]$/.exec(line.trim());
      if (!match) return [];
      const [left, bottom, right, top] = match.slice(1).map(Number);
      const area = Math.abs(right - left) * Math.abs(top - bottom);
      return Number.isFinite(area) && area > 0 ? [area] : [];
    });
    if (mediaBoxes.length !== pageCount) throw mapEngineFailure(logs.join("\n"));
    pageAreaSquarePoints = mediaBoxes.reduce((sum, area) => sum + area, 0);
    if (!thumbnails) return { pageCount, pageAreaSquarePoints, thumbnails: [] };
  } finally {
    if (engineInstance) {
      try {
        engineInstance.FS.unlink(inputName(0));
      } catch {
        // The in-memory filesystem is discarded with this module.
      }
    }
    engineInstance = null;
  }
  const rendered = await runPlan(id, [file.slice(0)], buildThumbnailCommand());
  return { pageCount: rendered.length, pageAreaSquarePoints, thumbnails: rendered };
}

async function inspect(
  id: number,
  files: ArrayBuffer[],
  thumbnails: boolean,
): Promise<InspectDocument[]> {
  if (!files.length || files.length > 50) {
    throw new EngineError("invalid-options", publicMessage("invalid-options"));
  }
  const documents: InspectDocument[] = [];
  for (const file of files) {
    documents.push(await inspectOne(id, file, thumbnails));
  }
  return documents;
}

async function execute(
  id: number,
  files: ArrayBuffer[],
  tool: WorkerRequest["tool"],
  options: ExecuteOptions,
): Promise<WorkerOutput[]> {
  if (!tool || !files.length) {
    throw new EngineError("invalid-options", publicMessage("invalid-options"));
  }
  if (tool === "extract" || tool === "remove" || tool === "reorder") {
    const pages = options.pages ?? [];
    const inspected = await inspectOne(id, files[0], false);
    if (!pages.length || pages.some((page) => !Number.isSafeInteger(page) || page < 1 || page > inspected.pageCount)) {
      throw new EngineError("invalid-options", publicMessage("invalid-options"));
    }
    const selected: ArrayBuffer[] = [];
    for (let index = 0; index < pages.length; index += 1) {
      reply({ id, type: "status", state: "processing", page: pages[index] });
      const [output] = await runPlan(id, [files[0].slice(0)], buildSplitCommand(pages[index]));
      selected.push(output.bytes);
    }
    if (selected.length === 1) return [{ name: "output.pdf", mimeType: "application/pdf", bytes: selected[0] }];
    return runPlan(id, selected, buildCommand("merge", selected.length, {}));
  }
  if (tool !== "split") return runPlan(id, files, buildCommand(tool, files.length, options));

  const inspected = await inspectOne(id, files[0], false);
  const outputs: WorkerOutput[] = [];
  for (let page = 1; page <= inspected.pageCount; page += 1) {
    reply({ id, type: "status", state: "processing", page });
    const [output] = await runPlan(id, [files[0].slice(0)], buildSplitCommand(page));
    outputs.push(output);
  }
  return outputs;
}

self.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (!request || !Number.isSafeInteger(request.id)) return;
  if (busy) {
    reply({ id: request.id, type: "error", code: "busy", message: publicMessage("busy") });
    return;
  }
  try {
    if (request.type === "initialise") {
      busy = true;
      reply({ id: request.id, type: "status", state: "preparing" });
      await initialise();
      reply({ id: request.id, type: "ready" });
      return;
    }
    busy = true;
    if (request.type === "inspect") {
      const documents = await inspect(request.id, request.files ?? [], Boolean(request.thumbnails));
      const transfer = documents.flatMap((document) =>
        document.thumbnails.map((thumbnail) => thumbnail.bytes),
      );
      reply({ id: request.id, type: "inspected", documents }, transfer);
      return;
    }
    if (request.type === "execute") {
      const outputs = await execute(
        request.id,
        request.files ?? [],
        request.tool,
        request.options ?? {},
      );
      reply(
        { id: request.id, type: "completed", outputs },
        outputs.map((output) => output.bytes),
      );
    }
  } catch (error) {
    const failure = error instanceof EngineError
      ? error
      : new EngineError("engine-failed", publicMessage("engine-failed"));
    reply({ id: request.id, type: "error", code: failure.code, message: failure.message });
  } finally {
    busy = false;
  }
});
