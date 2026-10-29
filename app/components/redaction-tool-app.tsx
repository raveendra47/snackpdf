"use client";

import { useClientReady } from "./use-client-ready";

import { pdfReadError } from "../lib/pdf-read-error";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { PagePositionControls, type PagePosition } from "./page-position-controls";

interface Box {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PagePreview {
  page: number;
  width: number;
  height: number;
  imageUrl: string;
  boxes: Box[];
}

interface Point {
  x: number;
  y: number;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function pointFromEvent(event: ReactPointerEvent<HTMLDivElement>): Point {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / rect.width),
    y: clamp((event.clientY - rect.top) / rect.height),
  };
}

function validatePdf(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".pdf") || (file.type && !["application/pdf", "application/x-pdf"].includes(file.type))) return "Choose a PDF file.";
  if (!file.size) return "This file is empty.";
  if (file.size > 500 * 1024 * 1024) return "This file is too large to process safely in this browser.";
  return null;
}

function downloadBase(filename: string): string {
  const base = filename.replace(/\.pdf$/i, "").replace(/[^a-zA-Z0-9._ -]+/g, "-").replace(/[ ._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return base || "document";
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("The browser could not create a page image.")), "image/png"));
}

function sizeChange(input: number, output: number): string {
  const difference = output - input;
  if (difference === 0) return "The output is the same size as the original.";
  return difference > 0 ? `The output is ${Math.ceil(difference / 1024)} KB larger than the original.` : `The output is ${Math.ceil(Math.abs(difference) / 1024)} KB smaller than the original.`;
}

export function RedactionToolApp() {
  const clientReady = useClientReady();
  const [file, setFile] = useState<File | null>(null);
  const [previews, setPreviews] = useState<PagePreview[]>([]);
  const [resolution, setResolution] = useState<150 | 200 | 300>(200);
  const [phase, setPhase] = useState<"idle" | "reading" | "saving" | "done" | "error">("idle");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState<number | null>(null);
  const [drawing, setDrawing] = useState<{ page: number; start: Point; current: Point } | null>(null);
  const drawingRef = useRef<{ page: number; start: Point; current: Point } | null>(null);
  const nextBoxId = useRef(1);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isBusy = phase === "reading" || phase === "saving";
  const boxCount = previews.reduce((sum, page) => sum + page.boxes.length, 0);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("snackpdf:job-state", { detail: { active: isBusy } }));
    return () => { window.dispatchEvent(new CustomEvent("snackpdf:job-state", { detail: { active: false } })); };
  }, [isBusy]);

  useEffect(() => () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
  }, [resultUrl]);

  const chooseFile = async (candidate: File | undefined) => {
    if (!candidate || isBusy) return;
    const validation = validatePdf(candidate);
    if (validation) {
      setError(validation);
      setPhase("error");
      return;
    }
    setFile(candidate);
    setPreviews([]);
    setResultUrl(null);
    setResultSize(null);
    setError("");
    setPhase("reading");
    setStatus("Rendering local page previews");
    try {
      const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist/build/pdf.min.mjs");
      GlobalWorkerOptions.workerSrc = "/ocr/pdf.worker.min.mjs";
      const pdf = await getDocument({ data: new Uint8Array(await candidate.arrayBuffer()), useWorkerFetch: false, isOffscreenCanvasSupported: false, useWasm: false }).promise;
      if (pdf.numPages < 1 || pdf.numPages > 50) throw new Error("This PDF has an unsupported number of pages. Choose a PDF with 1 to 50 pages.");
      const next: PagePreview[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        setStatus(`Rendering page ${pageNumber} of ${pdf.numPages}`);
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("This browser could not create a page preview.");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport }).promise;
        next.push({ page: pageNumber, width: viewport.width, height: viewport.height, imageUrl: canvas.toDataURL("image/jpeg", 0.82), boxes: [] });
      }
      setPreviews(next);
      setStatus("");
      setPhase("idle");
    } catch (failure) {
      setPreviews([]);
      setStatus("");
      setPhase("error");
      setError(pdfReadError(failure, "The PDF could not be rendered locally."));
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const clearResult = () => { setResultUrl(null); setResultSize(null); };

  const addBox = (pageNumber: number, position: PagePosition) => {
    if (isBusy) return;
    clearResult();
    setPreviews((current) => current.map((page) => page.page === pageNumber ? { ...page, boxes: [...page.boxes, { id: nextBoxId.current++, ...position }] } : page));
  };

  const finishDrawing = () => {
    const activeDrawing = drawingRef.current;
    if (!activeDrawing) return;
    const x = Math.min(activeDrawing.start.x, activeDrawing.current.x);
    const y = Math.min(activeDrawing.start.y, activeDrawing.current.y);
    const width = Math.abs(activeDrawing.start.x - activeDrawing.current.x);
    const height = Math.abs(activeDrawing.start.y - activeDrawing.current.y);
    drawingRef.current = null;
    setDrawing(null);
    if (width < 0.01 || height < 0.01) return;
    addBox(activeDrawing.page, { x, y, width, height });
  };

  const removeBox = (pageNumber: number, boxId: number) => {
    if (isBusy) return;
    clearResult();
    setPreviews((current) => current.map((page) => page.page === pageNumber ? { ...page, boxes: page.boxes.filter((box) => box.id !== boxId) } : page));
  };

  const applyRedactions = async () => {
    if (!file || !boxCount || isBusy) return;
    setPhase("saving");
    setError("");
    setStatus("Rebuilding redacted pages locally");
    try {
      const [{ PDFDocument }, { getDocument, GlobalWorkerOptions }] = await Promise.all([
        import("pdf-lib"),
        import("pdfjs-dist/build/pdf.min.mjs"),
      ]);
      GlobalWorkerOptions.workerSrc = "/ocr/pdf.worker.min.mjs";
      const bytes = new Uint8Array(await file.arrayBuffer());
      const source = await PDFDocument.load(bytes);
      const output = await PDFDocument.create();
      const sourcePages = source.getPages();
      const pdf = await getDocument({ data: bytes, useWorkerFetch: false, isOffscreenCanvasSupported: false, useWasm: false }).promise;
      for (let index = 0; index < sourcePages.length; index += 1) {
        const preview = previews[index];
        if (!preview?.boxes.length) {
          const [copied] = await output.copyPages(source, [index]);
          output.addPage(copied);
          continue;
        }
        setStatus(`Rasterising redacted page ${index + 1} of ${sourcePages.length}`);
        const page = await pdf.getPage(index + 1);
        const scale = resolution / 72;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("This browser could not create a redaction canvas.");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport }).promise;
        context.fillStyle = "#000000";
        for (const box of preview.boxes) context.fillRect(box.x * canvas.width, box.y * canvas.height, box.width * canvas.width, box.height * canvas.height);
        const image = await output.embedPng(new Uint8Array(await (await canvasBlob(canvas)).arrayBuffer()));
        const rebuilt = output.addPage([viewport.width / scale, viewport.height / scale]);
        rebuilt.drawImage(image, { x: 0, y: 0, width: viewport.width / scale, height: viewport.height / scale });
      }
      const outputBytes = await output.save();
      const outputBuffer = outputBytes.buffer.slice(outputBytes.byteOffset, outputBytes.byteOffset + outputBytes.byteLength) as ArrayBuffer;
      const blob = new Blob([outputBuffer], { type: "application/pdf" });
      setResultUrl(URL.createObjectURL(blob));
      setResultSize(blob.size);
      setStatus("");
      setPhase("done");
    } catch (failure) {
      setStatus("");
      setPhase("error");
      setError(failure instanceof Error ? failure.message : "The PDF could not be redacted locally.");
    }
  };

  return (
    <section className="redaction-workspace" aria-labelledby="redaction-workspace-heading">
      <h2 id="redaction-workspace-heading">Mark content to remove</h2>
      <div className="file-area">
        <label className="file-label" htmlFor="redact-pdf-file">Choose PDF to redact</label>
        <input ref={inputRef} id="redact-pdf-file" className="file-input" type="file" disabled={!clientReady || isBusy} aria-describedby={error ? "redaction-error" : undefined} accept="application/pdf,.pdf" aria-label="Choose PDF to redact" onChange={(event) => void chooseFile(event.target.files?.[0])} />
        <p>Files stay on this device. Draw a box over each area to remove, or use the position controls beneath each page.</p>
      </div>
      {file ? <p className="ocr-selected-file"><strong>Selected:</strong> {file.name} · {Math.round(file.size / 1024)} KB</p> : null}
      <fieldset className="settings inline-settings">
        <legend>Saved-page resolution</legend>
        {[150, 200, 300].map((value) => <label key={value}><input type="radio" name="redaction-resolution" value={value} checked={resolution === value} onChange={() => { clearResult(); setResolution(value as 150 | 200 | 300); }} disabled={isBusy} /><span>{value} DPI</span></label>)}
        <p className="setting-note">Higher resolution keeps printed text clearer but creates a larger file and uses more memory. The default is 200 DPI.</p>
      </fieldset>
      <p className="redaction-warning"><strong>Important:</strong> affected pages will become images and lose searchable or selectable text. Unaffected pages keep their text layer.</p>
      {status ? <div className="message status-message" role="status" aria-live="polite"><strong>{status}</strong></div> : null}
      {error ? <div id="redaction-error" className="message error-message" role="alert">{error}</div> : null}
      {previews.length ? (
        <div className="redaction-pages">
          {previews.map((page) => (
            <article className="redaction-page" key={page.page}>
              <div className="redaction-page-heading"><h3>Page {page.page}</h3><span>{page.boxes.length} {page.boxes.length === 1 ? "box" : "boxes"}</span></div>
              <div
                className="redaction-surface"
                onPointerDown={(event) => {
                  if (isBusy) return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  const point = pointFromEvent(event);
                  const nextDrawing = { page: page.page, start: point, current: point };
                  drawingRef.current = nextDrawing;
                  setDrawing(nextDrawing);
                }}
                onPointerMove={(event) => {
                  const current = drawingRef.current;
                  if (current?.page !== page.page) return;
                  const nextDrawing = { ...current, current: pointFromEvent(event) };
                  drawingRef.current = nextDrawing;
                  setDrawing(nextDrawing);
                }}
                onPointerUp={finishDrawing}
                onPointerCancel={() => { drawingRef.current = null; setDrawing(null); }}
              >
                <img src={page.imageUrl} alt={`Page ${page.page} preview`} draggable="false" />
                {page.boxes.map((box) => <span className="redaction-box" style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` }} key={box.id} aria-hidden="true" />)}
                {drawing?.page === page.page ? <span className="redaction-box redaction-box-draft" style={{ left: `${Math.min(drawing.start.x, drawing.current.x) * 100}%`, top: `${Math.min(drawing.start.y, drawing.current.y) * 100}%`, width: `${Math.abs(drawing.start.x - drawing.current.x) * 100}%`, height: `${Math.abs(drawing.start.y - drawing.current.y) * 100}%` }} aria-hidden="true" /> : null}
              </div>
              <PagePositionControls page={page.page} rectangle disabled={isBusy} onAdd={(position) => addBox(page.page, position)} />
              {page.boxes.length ? <ul className="redaction-box-list">{page.boxes.map((box, index) => <li key={box.id}>Box {index + 1}<button className="link-button" type="button" disabled={isBusy} aria-label={`Remove box ${index + 1} from page ${page.page}`} onClick={(event) => { event.currentTarget.closest(".redaction-page")?.querySelector<HTMLButtonElement>(".position-controls button")?.focus(); removeBox(page.page, box.id); }}>Remove</button></li>)}</ul> : <p className="drop-hint">Drag on this page to add a redaction box.</p>}
            </article>
          ))}
        </div>
      ) : null}
      {resultUrl && resultSize !== null && file ? (
        <section className="results" aria-labelledby="redaction-done-heading">
          <h2 id="redaction-done-heading">Redaction complete</h2>
          <p>{sizeChange(file.size, resultSize)}</p>
          <p>Review the saved PDF by searching for removed text, selecting text on affected pages and extracting text with another PDF tool.</p>
          <a className="download-link" href={resultUrl} download={`${downloadBase(file.name)}-redacted.pdf`}>Download redacted PDF</a>
        </section>
      ) : null}
      <button className="primary-button" type="button" disabled={!boxCount || isBusy} onClick={() => void applyRedactions()}>{phase === "reading" ? "Preparing previews…" : phase === "saving" ? "Saving redacted PDF…" : "Apply redactions"}</button>
    </section>
  );
}
