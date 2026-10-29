"use client";

import { useClientReady } from "./use-client-ready";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  COMPRESSION_PROFILES,
} from "../../src/engine/profiles";
import {
  complementPages,
  parsePageSelection,
  sanitiseDownloadBase,
} from "../../src/engine/commands";
import type {
  CompressionProfile,
  ExecuteOptions,
  ImageResolution,
  WorkerOutput,
} from "../../src/engine/types";
import { LocalEngine } from "../lib/engine-client";
import type { ToolDefinition } from "../lib/catalog";

interface Thumbnail {
  page: number;
  url: string;
}

interface SelectedPdf {
  id: number;
  file: File;
  pageCount: number | null;
  pageAreaSquarePoints: number | null;
  thumbnails: Thumbnail[];
}

interface ResultFile {
  name: string;
  url: string;
  size: number;
  blob: Blob;
  mimeType: string;
  typeLabel: string;
  pageCount: number | null;
  warning?: string;
}

interface SnackDirectoryHandle {
  getFileHandle(name: string, options: { create: true }): Promise<{
    createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
  }>;
}

type Phase = "idle" | "reading" | "preparing" | "processing" | "creating" | "done" | "error";

const TOO_LARGE_MESSAGE = "This file is too large to process safely in this browser. Try SnackPDF on a device with more available memory.";

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value < 10 ? value.toFixed(1) : value.toFixed(0)} ${unit}`;
}

async function hasPdfSignature(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  let text = "";
  for (const byte of head) text += String.fromCharCode(byte);
  return text.includes("%PDF-");
}

async function assertUnlockPassword(file: ArrayBuffer, password: string): Promise<void> {
  let loadingTask: { promise: Promise<unknown>; destroy?: () => Promise<void> } | null = null;
  try {
    const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist/build/pdf.min.mjs");
    GlobalWorkerOptions.workerSrc = "/ocr/pdf.worker.min.mjs";
    loadingTask = getDocument({
      data: new Uint8Array(file.slice(0)),
      password,
      useWorkerFetch: false,
      isOffscreenCanvasSupported: false,
      useWasm: false,
    });
    await loadingTask.promise;
  } catch {
    throw new Error("The password was not accepted.");
  } finally {
    if (loadingTask?.destroy) await loadingTask.destroy().catch(() => undefined);
  }
}

function validateChosenFile(file: File): string | null {
  const extensionLooksRight = file.name.toLowerCase().endsWith(".pdf");
  const mimeLooksRight = !file.type || file.type === "application/pdf" || file.type === "application/x-pdf";
  if (!extensionLooksRight || !mimeLooksRight) return "Choose a PDF file.";
  if (file.size === 0) return "This file is empty.";
  if (file.size > 500 * 1024 * 1024) return TOO_LARGE_MESSAGE;
  return null;
}

function estimatedMemory(files: SelectedPdf[], tool: ToolDefinition, resolution: ImageResolution): number {
  const totalBytes = files.reduce((sum, entry) => sum + entry.file.size, 0);
  const pages = files.reduce((sum, entry) => sum + (entry.pageCount ?? 1), 0);
  if (tool.kind === "images") {
    const a4SquarePoints = 595 * 842;
    const pageAreaSquarePoints = files.reduce(
      (sum, entry) => sum + (entry.pageAreaSquarePoints ?? (entry.pageCount ?? 1) * a4SquarePoints),
      0,
    );
    const rasterBytes = (pageAreaSquarePoints / (72 * 72)) * resolution * resolution * 4 * 1.35;
    return totalBytes * 3 + rasterBytes;
  }
  const multiplier = tool.kind.startsWith("thumbnails") ? 7 : 5;
  return totalBytes * multiplier + pages * 1.5 * 1024 * 1024;
}

function safeMemoryLimit(): number {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (memory) return Math.min(700, Math.max(180, memory * 110)) * 1024 * 1024;
  return (window.innerWidth < 800 ? 220 : 520) * 1024 * 1024;
}

function revokeThumbnails(entries: SelectedPdf[]): void {
  for (const entry of entries) for (const thumbnail of entry.thumbnails) URL.revokeObjectURL(thumbnail.url);
}

function revokeResults(entries: ResultFile[]): void {
  for (const entry of entries) URL.revokeObjectURL(entry.url);
}

function resultName(tool: ToolDefinition, original: string, workerName: string): string {
  if (workerName.startsWith("page-") || workerName.startsWith("thumb-")) return workerName;
  const base = sanitiseDownloadBase(original);
  const names: Record<string, string> = {
    compress: `${base}-compressed.pdf`,
    rebuild: `${base}-rebuilt.pdf`,
    merge: "merged.pdf",
    extract: `${base}-extracted.pdf`,
    remove: `${base}-pages-removed.pdf`,
    reorder: `${base}-reordered.pdf`,
    "pdf-to-text": `${base}.txt`,
    unlock: `${base}-unlocked.pdf`,
    grayscale: `${base}-grayscale.pdf`,
  };
  return names[tool.engineTool] ?? workerName;
}

function resultType(mimeType: string): string {
  if (mimeType === "application/pdf") return "PDF document";
  if (mimeType === "image/jpeg") return "JPEG image";
  if (mimeType === "image/png") return "PNG image";
  if (mimeType.startsWith("text/plain")) return "UTF-8 text file";
  return "File";
}

function resultPageCount(
  tool: ToolDefinition,
  sourcePages: Array<number | null>,
  selectedPages: number[],
): number | null {
  if (tool.engineTool === "split") return 1;
  if (["extract", "remove", "reorder"].includes(tool.engineTool)) return selectedPages.length;
  if (tool.engineTool === "merge") {
    return sourcePages.every((count): count is number => count !== null)
      ? sourcePages.reduce((sum, count) => sum + (count ?? 0), 0)
      : null;
  }
  if (["compress", "rebuild", "grayscale", "unlock"].includes(tool.engineTool)) {
    return sourcePages[0] ?? null;
  }
  return null;
}

function transformationSummary(tool: ToolDefinition, outputCount: number): string {
  const summaries: Record<string, string> = {
    compress: "Rebuilt the PDF using the selected compression profile.",
    rebuild: "Created a fresh PDF from readable content in the original.",
    grayscale: "Converted the PDF content to grayscale.",
    merge: "Joined the selected PDFs in the confirmed order.",
    split: `Split the PDF into ${outputCount} individual page ${outputCount === 1 ? "file" : "files"}.`,
    extract: "Created one PDF from the interpreted page sequence.",
    remove: "Created one PDF containing the retained pages.",
    reorder: "Created one PDF in the arranged page order.",
    "pdf-to-jpg": `Created ${outputCount} JPEG ${outputCount === 1 ? "image" : "images"}.`,
    "pdf-to-png": `Created ${outputCount} PNG ${outputCount === 1 ? "image" : "images"}.`,
    "pdf-to-text": "Extracted stored text into a UTF-8 text file. No OCR was performed.",
    unlock: "Created an unlocked PDF using the password you supplied.",
  };
  return summaries[tool.engineTool] ?? "Created the requested output.";
}

function cancellationError(): Error {
  const error = new Error("The operation was cancelled.");
  error.name = "cancelled";
  return error;
}

export function ToolApp({ tool }: { tool: ToolDefinition }) {
  const clientReady = useClientReady();
  const [engine] = useState(() => new LocalEngine());
  const idRef = useRef(1);
  const sampleLoadedRef = useRef(false);
  const operationRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<SelectedPdf[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [results, setResults] = useState<ResultFile[]>([]);
  const [completedInputSize, setCompletedInputSize] = useState(0);
  const [completedInputPages, setCompletedInputPages] = useState<number | null>(null);
  const [completedTransformation, setCompletedTransformation] = useState("");
  const [profile, setProfile] = useState<CompressionProfile>("balanced");
  const [resolution, setResolution] = useState<ImageResolution>(150);
  const [pageRange, setPageRange] = useState("");
  const [password, setPassword] = useState("");
  const [removedPages, setRemovedPages] = useState<number[]>([]);
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const [draggedPage, setDraggedPage] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [directorySavingSupported] = useState(() => typeof window !== "undefined" && "showDirectoryPicker" in window);
  const filesForCleanup = useRef<SelectedPdf[]>([]);
  const resultsForCleanup = useRef<ResultFile[]>([]);

  const isBusy = phase === "reading" || phase === "preparing" || phase === "processing" || phase === "creating";
  const originalSize = files.reduce((sum, entry) => sum + entry.file.size, 0);
  const outputSize = results.reduce((sum, entry) => sum + entry.size, 0);
  const completedBytesSaved = Math.max(0, completedInputSize - outputSize);
  const completedPercentageSaved = completedInputSize > 0
    ? Math.max(0, Math.round((1 - outputSize / completedInputSize) * 100))
    : 0;
  const pageCount = files[0]?.pageCount ?? null;

  const interpretedPages = useMemo(() => {
    if (tool.kind !== "pages" || pageCount === null || !pageRange.trim()) return { pages: [] as number[], error: "" };
    try {
      return { pages: parsePageSelection(pageRange, pageCount), error: "" };
    } catch (failure) {
      return { pages: [] as number[], error: failure instanceof Error ? failure.message : "The page sequence is not valid." };
    }
  }, [pageCount, pageRange, tool.kind]);

  useEffect(() => {
    filesForCleanup.current = files;
  }, [files]);

  useEffect(() => {
    resultsForCleanup.current = results;
  }, [results]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("snackpdf:job-state", { detail: { active: isBusy } }));
    return () => {
      window.dispatchEvent(new CustomEvent("snackpdf:job-state", { detail: { active: false } }));
    };
  }, [isBusy]);

  useEffect(() => () => {
    operationRef.current += 1;
    revokeThumbnails(filesForCleanup.current);
    revokeResults(resultsForCleanup.current);
    engine.dispose();
  }, [engine]);

  const statusFromWorker = (state: string, page?: number) => {
    if (state === "preparing") {
      setPhase("preparing");
      setStatus("Preparing");
      return;
    }
    setPhase("processing");
    setStatus(page ? `Processing page ${page}` : "Processing");
  };

  const assertCurrentOperation = (operation: number) => {
    if (operation !== operationRef.current) throw cancellationError();
  };

  const inspectFile = async (entry: SelectedPdf, operation: number): Promise<SelectedPdf> => {
    if (tool.kind === "password") return entry;
    setStatus("Reading file");
    const buffer = await entry.file.arrayBuffer();
    assertCurrentOperation(operation);
    const wantsThumbnails = tool.kind === "thumbnails-remove" || tool.kind === "thumbnails-reorder";
    setStatus("Inspecting");
    const inspectStatus = (state: string) => {
      setPhase(state === "preparing" ? "preparing" : "processing");
      setStatus(state === "preparing" ? "Preparing" : "Inspecting");
    };
    const [document] = await engine.inspect([buffer], false, inspectStatus);
    assertCurrentOperation(operation);
    const counted = { ...entry, pageCount: document.pageCount, pageAreaSquarePoints: document.pageAreaSquarePoints };
    if (estimatedMemory([counted], tool, resolution) > safeMemoryLimit()) {
      throw new Error(TOO_LARGE_MESSAGE);
    }
    if (!wantsThumbnails) return counted;
    setStatus("Inspecting");
    const thumbnailBuffer = await entry.file.arrayBuffer();
    assertCurrentOperation(operation);
    const rendered = wantsThumbnails
      ? (await engine.inspect([thumbnailBuffer], true, inspectStatus))[0]
      : document;
    assertCurrentOperation(operation);
    const thumbnails = rendered.thumbnails.map((thumbnail, index) => ({
      page: index + 1,
      url: URL.createObjectURL(new Blob([thumbnail.bytes], { type: thumbnail.mimeType })),
    }));
    return { ...entry, pageCount: document.pageCount, pageAreaSquarePoints: document.pageAreaSquarePoints, thumbnails };
  };

  const chooseFiles = async (chosen: File[]) => {
    if (!chosen.length || isBusy) return;
    if (tool.kind !== "multiple" && chosen.length !== 1) {
      setPhase("error");
      setError("Choose one PDF at a time for this tool.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (tool.kind === "multiple" && files.length + chosen.length > 50) {
      setPhase("error");
      setStatus("");
      setError("Choose no more than 50 PDFs at a time.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setError("");
    setAnnouncement("");
    setSaveMessage("");
    revokeResults(results);
    setResults([]);
    setPhase("reading");
    setStatus(chosen.length === 1 ? "Reading file" : "Reading files");

    const operation = operationRef.current + 1;
    operationRef.current = operation;
    const limited = tool.kind === "multiple" ? chosen.slice(0, 50) : chosen;
    const baseEntries = tool.kind === "multiple" ? files : [];
    if (tool.kind !== "multiple") {
      revokeThumbnails(files);
      setFiles([]);
      setPageRange("");
      setPassword("");
      setRemovedPages([]);
      setPageOrder([]);
    }
    const nextEntries = [...baseEntries];

    try {
      for (const file of limited) {
        const validation = validateChosenFile(file);
        if (validation) throw new Error(validation);
        const candidate = { id: idRef.current++, file, pageCount: null, pageAreaSquarePoints: null, thumbnails: [] };
        if (estimatedMemory([...nextEntries, candidate], tool, resolution) > safeMemoryLimit()) throw new Error(TOO_LARGE_MESSAGE);
        if (!(await hasPdfSignature(file))) throw new Error("This does not appear to be a valid PDF.");
        assertCurrentOperation(operation);
        const inspected = await inspectFile(candidate, operation);
        assertCurrentOperation(operation);
        if (estimatedMemory([...nextEntries, inspected], tool, resolution) > safeMemoryLimit()) throw new Error(TOO_LARGE_MESSAGE);
        nextEntries.push(inspected);
        setFiles([...nextEntries]);
        if (inspected.pageCount && tool.kind === "thumbnails-reorder") {
          setPageOrder(Array.from({ length: inspected.pageCount }, (_, index) => index + 1));
        }
      }
      assertCurrentOperation(operation);
      setFiles([...nextEntries]);
      setPhase("idle");
      setStatus("");
    } catch (failure) {
      if (operation !== operationRef.current) {
        revokeThumbnails(nextEntries);
        return;
      }
      setFiles(nextEntries);
      setPhase("error");
      setStatus("");
      setError(failure instanceof Error ? failure.message : "The PDF could not be read.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  useEffect(() => {
    if (tool.slug !== "compress-pdf" || sampleLoadedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("sample") !== "1") return;
    sampleLoadedRef.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    void fetch("/snackpdf-sample.pdf")
      .then(async (response) => {
        if (!response.ok) throw new Error("The sample PDF is unavailable.");
        const blob = await response.blob();
        await chooseFiles([new File([blob], "snackpdf-sample.pdf", { type: "application/pdf" })]);
      })
      .catch(() => {
        setPhase("error");
        setError("The sample PDF could not be opened. Reload while connected and try again.");
      });
    // This runs once for the sample route; chooseFiles intentionally uses the initial empty workspace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool.slug]);

  const removeFile = (id: number) => {
    const removing = files.find((entry) => entry.id === id);
    if (removing) revokeThumbnails([removing]);
    setFiles((current) => current.filter((entry) => entry.id !== id));
    if (tool.kind !== "multiple") {
      setPageRange("");
      setPassword("");
      setRemovedPages([]);
      setPageOrder([]);
    }
  };

  const moveFile = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= files.length) return;
    const copy = [...files];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    setFiles(copy);
    setAnnouncement(`${copy[target].file.name} moved to position ${target + 1} of ${copy.length}.`);
  };

  const movePage = (page: number, destination: "left" | "right" | "start" | "end") => {
    const index = pageOrder.indexOf(page);
    if (index < 0) return;
    let target = index;
    if (destination === "left") target = Math.max(0, index - 1);
    if (destination === "right") target = Math.min(pageOrder.length - 1, index + 1);
    if (destination === "start") target = 0;
    if (destination === "end") target = pageOrder.length - 1;
    const copy = [...pageOrder];
    copy.splice(index, 1);
    copy.splice(target, 0, page);
    setPageOrder(copy);
    setAnnouncement(`Page ${page} moved to position ${target + 1} of ${copy.length}.`);
  };

  const dropPage = (targetPage: number) => {
    if (draggedPage === null || draggedPage === targetPage) return;
    setPageOrder((current) => {
      const copy = current.filter((page) => page !== draggedPage);
      const target = copy.indexOf(targetPage);
      copy.splice(target, 0, draggedPage);
      setAnnouncement(`Page ${draggedPage} moved to position ${target + 1} of ${copy.length}.`);
      return copy;
    });
    setDraggedPage(null);
  };

  const canProcess = useMemo(() => {
    if (isBusy || results.length) return false;
    if (tool.kind === "multiple") return files.length >= 2;
    if (files.length !== 1) return false;
    if (tool.kind === "password") return password.length > 0;
    if (tool.kind === "pages") return interpretedPages.pages.length > 0 && !interpretedPages.error;
    if (tool.kind === "thumbnails-remove") return removedPages.length > 0 && pageCount !== null && removedPages.length < pageCount;
    if (tool.kind === "thumbnails-reorder") return pageCount !== null && pageOrder.length === pageCount;
    return true;
  }, [files, interpretedPages, isBusy, pageCount, pageOrder, password, removedPages, results.length, tool.kind]);

  const process = async () => {
    if (!canProcess) return;
    setError("");
    setSaveMessage("");
    if (estimatedMemory(files, tool, resolution) > safeMemoryLimit()) {
      setPhase("error");
      setError(TOO_LARGE_MESSAGE);
      return;
    }
    const operation = operationRef.current + 1;
    operationRef.current = operation;
    const options: ExecuteOptions = {};
    try {
      if (tool.engineTool === "compress") options.profile = profile;
      if (tool.engineTool === "extract") options.pages = interpretedPages.pages;
      if (tool.engineTool === "remove") options.pages = complementPages(removedPages, pageCount!);
      if (tool.engineTool === "reorder") options.pages = pageOrder;
      if (tool.kind === "images") options.resolution = resolution;
      if (tool.engineTool === "unlock") options.password = password;

      setPhase("reading");
      setStatus(files.length === 1 ? "Reading file" : "Reading files");
      const firstFilename = files[0].file.name;
      const completedSize = originalSize;
      const sourcePages = files.map((entry) => entry.pageCount);
      const sourcePageTotal = sourcePages.every((count): count is number => count !== null)
        ? sourcePages.reduce((sum, count) => sum + (count ?? 0), 0)
        : null;
      const buffers = await Promise.all(files.map((entry) => entry.file.arrayBuffer()));
      assertCurrentOperation(operation);
      if (tool.engineTool === "unlock") await assertUnlockPassword(buffers[0], password);
      const outputs = await engine.execute(tool.engineTool, buffers, options, statusFromWorker);
      assertCurrentOperation(operation);
      setPhase("creating");
      setStatus("Creating output");
      const selectedPages = options.pages ?? [];
      const created = outputs.map((output: WorkerOutput) => {
        const name = resultName(tool, firstFilename, output.name);
        const blob = new Blob([output.bytes], { type: output.mimeType });
        const emptyText = output.mimeType.startsWith("text/plain") && new TextDecoder().decode(output.bytes).trim().length === 0;
        return {
          name,
          url: URL.createObjectURL(blob),
          size: output.bytes.byteLength,
          blob,
          mimeType: output.mimeType,
          typeLabel: resultType(output.mimeType),
          pageCount: output.mimeType === "application/pdf" ? resultPageCount(tool, sourcePages, selectedPages) : null,
          warning: emptyText ? "No stored text was found. This may be a scanned PDF; SnackPDF does not perform OCR." : undefined,
        };
      });
      outputs.length = 0;
      assertCurrentOperation(operation);
      engine.cancel();
      revokeThumbnails(files);
      setFiles([]);
      setCompletedInputSize(completedSize);
      setCompletedInputPages(sourcePageTotal);
      setCompletedTransformation(transformationSummary(tool, created.length));
      setResults(created);
      setPhase("done");
      setStatus("Done");
    } catch (failure) {
      if (operation !== operationRef.current) return;
      setPhase("error");
      setStatus("");
      setError(failure instanceof Error ? failure.message : "The resulting file could not be created.");
    } finally {
      setPassword("");
      options.password = undefined;
    }
  };

  const cancel = () => {
    operationRef.current += 1;
    engine.cancel();
    revokeThumbnails(files);
    setFiles([]);
    setPhase("error");
    setStatus("");
    setError("The operation was cancelled.");
    setPassword("");
    setCompletedInputSize(0);
    setCompletedInputPages(null);
    setCompletedTransformation("");
    setRemovedPages([]);
    setPageOrder([]);
  };

  const startAgain = () => {
    operationRef.current += 1;
    engine.cancel();
    revokeThumbnails(files);
    revokeResults(results);
    setFiles([]);
    setResults([]);
    setCompletedInputSize(0);
    setCompletedInputPages(null);
    setCompletedTransformation("");
    setError("");
    setStatus("");
    setPhase("idle");
    setPageRange("");
    setPassword("");
    setRemovedPages([]);
    setPageOrder([]);
    setAnnouncement("");
    setSaveMessage("");
    setProfile("balanced");
    setResolution(150);
  };

  const saveAllToFolder = async () => {
    const picker = (window as Window & { showDirectoryPicker?: () => Promise<SnackDirectoryHandle> }).showDirectoryPicker;
    if (!picker || !results.length) return;
    setSaveMessage("");
    try {
      const directory = await picker();
      for (const result of results) {
        const handle = await directory.getFileHandle(result.name, { create: true });
        const writable = await handle.createWritable();
        await writable.write(result.blob);
        await writable.close();
      }
      setSaveMessage(`${results.length} ${results.length === 1 ? "file" : "files"} saved to the chosen folder.`);
    } catch (failure) {
      if (failure instanceof DOMException && failure.name === "AbortError") return;
      setSaveMessage("The files could not be saved to that folder. Use the individual download links instead.");
    }
  };

  const onDropFiles = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    void chooseFiles(Array.from(event.dataTransfer.files));
  };

  const thumbnails = files[0]?.thumbnails ?? [];
  const orderedThumbnails = pageOrder.map((page) => thumbnails.find((item) => item.page === page)).filter(Boolean) as Thumbnail[];
  const expectedOutputCount = pageCount && (tool.engineTool === "split" || tool.kind === "images") ? pageCount : null;
  const retainedPageCount = pageCount === null ? null : pageCount - removedPages.length;

  const toggleRemovedPage = (page: number) => {
    const selected = removedPages.includes(page);
    if (!selected && pageCount !== null && removedPages.length >= pageCount - 1) {
      setAnnouncement("At least one page must remain in the PDF.");
      return;
    }
    const next = selected
      ? removedPages.filter((entry) => entry !== page)
      : [...removedPages, page].sort((left, right) => left - right);
    setRemovedPages(next);
    if (pageCount !== null) {
      setAnnouncement(`${next.length} ${next.length === 1 ? "page" : "pages"} marked for removal; ${pageCount - next.length} retained.`);
    }
  };

  return (
    <div className="tool-workspace">
      <div className="file-area" onDragOver={(event) => event.preventDefault()} onDrop={onDropFiles}>
        <label
          htmlFor="pdf-file"
          className="file-label"
          role="button"
          tabIndex={0}
          aria-controls="pdf-file"
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
        >
          {tool.kind === "multiple" ? "Choose files" : "Choose PDF"}
        </label>
        <input
          ref={inputRef}
          id="pdf-file"
          className="file-input"
          type="file"
          accept="application/pdf,.pdf"
          multiple={tool.kind === "multiple"}
          disabled={!clientReady || isBusy}
          aria-label={tool.kind === "multiple" ? "Choose PDF files" : "Choose a PDF file"}
          aria-describedby={`file-privacy${error && !files.length ? " tool-error" : ""}`}
          tabIndex={-1}
          onChange={(event) => void chooseFiles(Array.from(event.target.files ?? []))}
        />
        <p id="file-privacy">Files stay on this device.</p>
        <p className="drop-hint">You can also drop {tool.kind === "multiple" ? "PDFs" : "a PDF"} here.</p>
      </div>

      {files.length ? (
        <section className="selected-files" aria-labelledby="selected-heading">
          <h2 id="selected-heading">Selected {files.length === 1 ? "file" : "files"}</h2>
          <ol>
            {files.map((entry, index) => (
              <li key={entry.id}>
                <span className="file-details">
                  <strong>{entry.file.name}</strong>
                  <small>{humanSize(entry.file.size)}{entry.pageCount ? ` · ${entry.pageCount} ${entry.pageCount === 1 ? "page" : "pages"}` : ""}</small>
                </span>
                {tool.kind === "multiple" ? (
                  <span className="file-actions">
                    <button type="button" aria-label={`Move ${entry.file.name} up`} onClick={() => moveFile(index, -1)} disabled={index === 0 || isBusy}>Move up</button>
                    <button type="button" aria-label={`Move ${entry.file.name} down`} onClick={() => moveFile(index, 1)} disabled={index === files.length - 1 || isBusy}>Move down</button>
                  </span>
                ) : null}
                <button type="button" aria-label={`Remove ${entry.file.name}`} onClick={() => removeFile(entry.id)} disabled={isBusy}>Remove</button>
              </li>
            ))}
          </ol>
          {tool.kind === "multiple" && files.length >= 2 ? (
            <p className="order-confirmation"><strong>Final order:</strong> {files.map((entry) => entry.file.name).join("; ")}</p>
          ) : null}
        </section>
      ) : null}

      {tool.engineTool === "compress" && files.length ? (
        <fieldset className="settings">
          <legend>Compression</legend>
          {(Object.entries(COMPRESSION_PROFILES) as [CompressionProfile, (typeof COMPRESSION_PROFILES)[CompressionProfile]][]).map(([value, setting]) => (
            <label key={value}>
              <input type="radio" name="compression" value={value} checked={profile === value} disabled={isBusy} onChange={() => setProfile(value)} />
              <span><strong>{setting.label}</strong><small>{setting.summary}</small></span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {tool.kind === "pages" && pageCount ? (
        <div className="settings single-setting">
          <label htmlFor="page-range">Pages</label>
          <input
            id="page-range"
            type="text"
            value={pageRange}
            disabled={isBusy}
            placeholder="1-4,6,8"
            aria-describedby={`page-range-help${interpretedPages.pages.length ? " page-range-interpreted" : ""}`}
            aria-invalid={Boolean(interpretedPages.error)}
            aria-errormessage={interpretedPages.error ? "page-range-error" : undefined}
            onChange={(event) => setPageRange(event.target.value)}
          />
          <p id="page-range-help">Use 1, 1-4, 1,3,8 or a combination. This PDF has {pageCount} pages.</p>
          {interpretedPages.pages.length ? <p id="page-range-interpreted"><strong>Interpreted sequence:</strong> {interpretedPages.pages.join(", ")}</p> : null}
          {interpretedPages.error ? <p id="page-range-error" className="inline-error" role="alert">{interpretedPages.error}</p> : null}
        </div>
      ) : null}

      {tool.kind === "images" && files.length ? (
        <fieldset className="settings inline-settings">
          <legend>Resolution</legend>
          {([96, 150, 300] as ImageResolution[]).map((value) => (
            <label key={value}>
              <input type="radio" name="resolution" checked={resolution === value} disabled={isBusy} onChange={() => setResolution(value)} />
              <span>{value === 96 ? "Screen" : value === 150 ? "Standard" : "Print"} — {value} DPI</span>
            </label>
          ))}
          {expectedOutputCount ? <p className="setting-note">Expected output: {expectedOutputCount} {expectedOutputCount === 1 ? "image" : "images"}.</p> : null}
          {resolution === 300 ? <p className="setting-warning">300 DPI uses substantially more memory. SnackPDF will stop before processing if the estimate is unsafe.</p> : null}
        </fieldset>
      ) : null}

      {tool.kind === "password" && files.length ? (
        <div className="settings single-setting">
          <label htmlFor="pdf-password">PDF password</label>
          <input id="pdf-password" type="password" autoComplete="off" maxLength={1024} value={password} disabled={isBusy} onChange={(event) => setPassword(event.target.value)} />
        </div>
      ) : null}

      {tool.kind === "thumbnails-remove" && thumbnails.length ? (
        <section className="page-section" aria-labelledby="remove-page-heading">
          <h2 id="remove-page-heading">Choose pages to remove</h2>
          <p aria-live="polite"><strong>{removedPages.length} removed</strong> · {retainedPageCount} retained. At least one page must remain.</p>
          <div className="thumbnail-grid">
            {thumbnails.map((thumbnail) => {
              const selected = removedPages.includes(thumbnail.page);
              return (
                <button
                  key={thumbnail.page}
                  type="button"
                  className={selected ? "thumbnail selected" : "thumbnail"}
                  aria-pressed={selected}
                  aria-label={`Page ${thumbnail.page}: ${selected ? "keep this page" : "remove this page"}`}
                  onClick={() => toggleRemovedPage(thumbnail.page)}
                  disabled={!selected && pageCount !== null && removedPages.length >= pageCount - 1}
                >
                  <img src={thumbnail.url} alt={`Page ${thumbnail.page} preview`} />
                  <span>Page {thumbnail.page}{selected ? " — remove" : ""}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {tool.kind === "thumbnails-reorder" && orderedThumbnails.length ? (
        <section className="page-section" aria-labelledby="reorder-page-heading">
          <h2 id="reorder-page-heading">Arrange pages</h2>
          <p>Drag pages or use the move buttons. The number shows the original page.</p>
          <div className="thumbnail-grid reorder-grid">
            {orderedThumbnails.map((thumbnail, index) => (
              <article
                key={thumbnail.page}
                className="thumbnail reorder-card"
                draggable={!isBusy}
                onDragStart={() => setDraggedPage(thumbnail.page)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => dropPage(thumbnail.page)}
              >
                <img src={thumbnail.url} alt={`Original page ${thumbnail.page} preview`} />
                <strong>Position {index + 1}: page {thumbnail.page}</strong>
                <div className="page-actions">
                  <button type="button" aria-label={`Move page ${thumbnail.page} to start`} onClick={() => movePage(thumbnail.page, "start")} disabled={isBusy || index === 0}>Start</button>
                  <button type="button" aria-label={`Move page ${thumbnail.page} left`} onClick={() => movePage(thumbnail.page, "left")} disabled={isBusy || index === 0}>Left</button>
                  <button type="button" aria-label={`Move page ${thumbnail.page} right`} onClick={() => movePage(thumbnail.page, "right")} disabled={isBusy || index === orderedThumbnails.length - 1}>Right</button>
                  <button type="button" aria-label={`Move page ${thumbnail.page} to end`} onClick={() => movePage(thumbnail.page, "end")} disabled={isBusy || index === orderedThumbnails.length - 1}>End</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {expectedOutputCount && tool.engineTool === "split" ? <p className="expected-output"><strong>Expected output:</strong> {expectedOutputCount} individual page {expectedOutputCount === 1 ? "file" : "files"}.</p> : null}
      <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
      {error ? <div id="tool-error" className="message error-message" role="alert">{error}</div> : null}
      {status ? <div className="message status-message" role="status" aria-live="polite"><strong>{status}</strong></div> : null}

      {isBusy ? <button className="secondary-button" type="button" onClick={cancel}>Cancel</button> : null}
      {!results.length ? <button className="primary-button" type="button" disabled={!canProcess} onClick={() => void process()}>{tool.action}</button> : null}

      {results.length ? (
        <section className="results" aria-labelledby="done-heading">
          <h2 id="done-heading">Done</h2>
          <dl className="result-summary">
            <div><dt>Action:</dt><dd>{completedTransformation}</dd></div>
            <div><dt>Input:</dt><dd>{humanSize(completedInputSize)}{completedInputPages ? ` · ${completedInputPages} ${completedInputPages === 1 ? "page" : "pages"}` : ""}</dd></div>
            <div><dt>Output:</dt><dd>{results.length} {results.length === 1 ? "file" : "files"} · {humanSize(outputSize)}</dd></div>
            {tool.engineTool === "compress" ? (
              <>
                <div><dt>Original size:</dt><dd>{humanSize(completedInputSize)}</dd></div>
                <div><dt>Result size:</dt><dd>{humanSize(outputSize)}</dd></div>
                <div><dt>Bytes saved:</dt><dd>{completedBytesSaved.toLocaleString("en-GB")} bytes</dd></div>
                <div><dt>Percentage saved:</dt><dd>{completedPercentageSaved}%</dd></div>
              </>
            ) : null}
          </dl>
          {tool.engineTool === "compress" ? (
            outputSize < completedInputSize
              ? null
              : outputSize > completedInputSize
                ? <p>The compressed PDF is {humanSize(outputSize - completedInputSize)} larger than the original. The original file may already be well optimised.</p>
                : <p>The output is the same size as the original. The original may already be well optimised.</p>
          ) : null}
          {tool.engineTool === "unlock" ? <p>The password was cleared after processing.</p> : tool.warning ? <p className="result-warning"><strong>Check the result:</strong> {tool.warning}</p> : null}
          <ol className="download-list">
            {results.map((result) => (
              <li key={result.name}>
                <dl className="result-file-details">
                  <div><dt>Filename:</dt><dd>{result.name}</dd></div>
                  <div><dt>Type:</dt><dd>{result.typeLabel}</dd></div>
                  <div><dt>Size:</dt><dd>{humanSize(result.size)}</dd></div>
                  {result.pageCount ? <div><dt>Page count:</dt><dd>{result.pageCount}</dd></div> : null}
                  {result.warning ? <div className="result-warning"><dt>Warning:</dt><dd>{result.warning}</dd></div> : null}
                  <div><dt>Save:</dt><dd><a className="download-link" href={result.url} download={result.name}>Download {result.name}</a></dd></div>
                </dl>
              </li>
            ))}
          </ol>
          {results.length > 1 && directorySavingSupported ? <button className="secondary-button" type="button" onClick={() => void saveAllToFolder()}>Save all to a folder</button> : null}
          {results.length > 1 ? <p className="save-help">Individual downloads work in every supported browser. If a file opens on a phone or tablet, use the browser&apos;s Share or Save to Files action.</p> : null}
          {saveMessage ? <p className="message" role="status" aria-live="polite">{saveMessage}</p> : null}
          <button className="secondary-button" type="button" onClick={startAgain}>Start again</button>
        </section>
      ) : null}
    </div>
  );
}
