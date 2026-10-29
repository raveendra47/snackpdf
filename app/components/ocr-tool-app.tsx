"use client";

import { useClientReady } from "./use-client-ready";

import { pdfReadError } from "../lib/pdf-read-error";

import { useEffect, useRef, useState } from "react";

interface OcrPage {
  page: number;
  text: string;
  confidence: number | null;
}

type OcrPhase = "idle" | "processing" | "done" | "error";

const LANGUAGES = [
  { code: "eng", label: "English", available: true },
  { code: "fra", label: "French", available: false },
  { code: "deu", label: "German", available: false },
  { code: "spa", label: "Spanish", available: false },
] as const;

function validatePdf(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".pdf") || (file.type && !["application/pdf", "application/x-pdf"].includes(file.type))) {
    return "Choose a PDF file.";
  }
  if (!file.size) return "This file is empty.";
  if (file.size > 500 * 1024 * 1024) return "This file is too large to process safely in this browser.";
  return null;
}

function downloadBase(filename: string): string {
  const base = filename.replace(/\.pdf$/i, "").replace(/[^a-zA-Z0-9._ -]+/g, "-").replace(/[ ._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return base || "document";
}

function confidenceLabel(confidence: number | null): string {
  return confidence === null || !Number.isFinite(confidence) ? "Confidence unavailable" : `${Math.round(confidence)}% confidence`;
}

function pageText(pages: OcrPage[]): string {
  return pages.map((page) => `Page ${page.page}\n${page.text.trim()}`).join("\n\n").trim() + "\n";
}

export function OcrToolApp() {
  const clientReady = useClientReady();
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState("eng");
  const [phase, setPhase] = useState<OcrPhase>("idle");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [pages, setPages] = useState<OcrPage[]>([]);
  const [copyMessage, setCopyMessage] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultUrlRef = useRef<string | null>(null);

  const isBusy = phase === "processing";

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("snackpdf:job-state", { detail: { active: isBusy } }));
    return () => { window.dispatchEvent(new CustomEvent("snackpdf:job-state", { detail: { active: false } })); };
  }, [isBusy]);

  useEffect(() => () => {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
  }, []);

  const chooseFile = (candidate: File | undefined) => {
    if (!candidate || isBusy) return;
    const validation = validatePdf(candidate);
    setError(validation ?? "");
    setCopyMessage("");
    setPages([]);
    setPhase(validation ? "error" : "idle");
    setStatus("");
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current = null;
    setResultUrl(null);
    if (!validation) setFile(candidate);
    if (inputRef.current) inputRef.current.value = "";
  };

  const extractText = async () => {
    if (!file || isBusy) return;
    setPhase("processing");
    setError("");
    setCopyMessage("");
    setPages([]);
    let pdf: { numPages: number; getPage(page: number): Promise<{
      getViewport(options: { scale: number }): { width: number; height: number };
      render(options: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }): { promise: Promise<void> };
      cleanup(): void;
    }>; destroy(): Promise<void> } | null = null;
    let ocrWorker: { setParameters(parameters: { preserve_interword_spaces: string }): Promise<unknown>; recognize(image: HTMLCanvasElement, options?: Record<string, never>, output?: { text: boolean }): Promise<{ data: { text: string; confidence?: number } }>; terminate(): Promise<unknown> } | null = null;
    try {
      setStatus("Loading the local PDF renderer");
      const [{ getDocument, GlobalWorkerOptions }, Tesseract] = await Promise.all([
        import("pdfjs-dist/build/pdf.min.mjs"),
        import("tesseract.js"),
      ]);
      GlobalWorkerOptions.workerSrc = "/ocr/pdf.worker.min.mjs";
      const bytes = new Uint8Array(await file.arrayBuffer());
      const loadedPdf = await getDocument({
        data: bytes,
        useWorkerFetch: false,
        isOffscreenCanvasSupported: false,
        useWasm: false,
      }).promise;
      pdf = loadedPdf;
      if (pdf.numPages < 1 || pdf.numPages > 100) throw new Error("This PDF has an unsupported number of pages. Choose a PDF with 1 to 100 pages.");

      setStatus("Loading bundled English OCR data");
      let recognisingPage = 1;
      ocrWorker = await Tesseract.createWorker("eng", Tesseract.OEM.LSTM_ONLY, {
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr/core",
        langPath: "/ocr/lang",
        cacheMethod: "none",
        workerBlobURL: false,
        gzip: true,
        logger: (message) => {
          if (message.status === "recognizing text") setStatus(`Recognising page ${recognisingPage} of ${loadedPdf.numPages}`);
          else if (message.status === "loading language traineddata") setStatus("Loading bundled English OCR data");
        },
      });
      await ocrWorker.setParameters({ preserve_interword_spaces: "1" });

      const extracted: OcrPage[] = [];
      for (let pageNumber = 1; pageNumber <= loadedPdf.numPages; pageNumber += 1) {
        setStatus(`Rendering page ${pageNumber} of ${loadedPdf.numPages}`);
        const page = await loadedPdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("This browser could not create a canvas for OCR.");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport }).promise;
        setStatus(`Recognising page ${pageNumber} of ${loadedPdf.numPages}`);
        recognisingPage = pageNumber;
        const recognised = await ocrWorker.recognize(canvas, {}, { text: true });
        extracted.push({
          page: pageNumber,
          text: recognised.data.text ?? "",
          confidence: typeof recognised.data.confidence === "number" ? recognised.data.confidence : null,
        });
        page.cleanup();
        setPages([...extracted]);
      }
      const text = pageText(extracted);
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const resultUrl = URL.createObjectURL(blob);
      resultUrlRef.current = resultUrl;
      setResultUrl(resultUrl);
      setStatus("");
      setPhase("done");
    } catch (failure) {
      setPhase("error");
      setStatus("");
      setError(pdfReadError(failure, "The PDF could not be read with local OCR."));
    } finally {
      await ocrWorker?.terminate().catch(() => undefined);
      await pdf?.destroy().catch(() => undefined);
    }
  };

  const copyAll = async () => {
    if (!pages.length) return;
    try {
      await navigator.clipboard.writeText(pageText(pages));
      setCopyMessage("All extracted text copied.");
    } catch {
      setCopyMessage("Copy is unavailable in this browser. Use the text boxes or download the file.");
    }
  };

  const copyPage = async (page: OcrPage) => {
    try {
      await navigator.clipboard.writeText(page.text);
      setCopyMessage(`Page ${page.page} text copied.`);
    } catch {
      setCopyMessage("Copy is unavailable in this browser. Select the text manually.");
    }
  };

  return (
    <section className="ocr-workspace" aria-labelledby="ocr-workspace-heading">
      <h2 id="ocr-workspace-heading">Extract text from a scanned PDF</h2>
      <div className="file-area">
        <label className="file-label" htmlFor="ocr-pdf-file">Choose scanned PDF</label>
        <input ref={inputRef} id="ocr-pdf-file" className="file-input" type="file" disabled={!clientReady || isBusy} aria-describedby={error ? "ocr-error" : undefined} accept="application/pdf,.pdf" aria-label="Choose scanned PDF" onChange={(event) => chooseFile(event.target.files?.[0])} />
        <p>Files stay on this device. OCR is performed in a browser Worker.</p>
        <p className="drop-hint">Choose a scan with printed text for the best results.</p>
      </div>
      {file ? <p className="ocr-selected-file"><strong>Selected:</strong> {file.name} · {Math.round(file.size / 1024)} KB</p> : null}
      <fieldset className="settings inline-settings">
        <legend>OCR language</legend>
        <label htmlFor="ocr-language">Language</label>
        <select id="ocr-language" value={language} onChange={(event) => setLanguage(event.target.value)} disabled={isBusy}>
          {LANGUAGES.map((option) => <option key={option.code} value={option.code} disabled={!option.available}>{option.label}{option.available ? "" : " (not bundled)"}</option>)}
        </select>
        <p className="setting-note">English is bundled for offline use. Other language files are not bundled, so they cannot be selected yet.</p>
      </fieldset>
      {error ? <div id="ocr-error" className="message error-message" role="alert">{error}</div> : null}
      {status ? <div className="message status-message" role="status" aria-live="polite"><strong>{status}</strong></div> : null}
      {phase === "done" && pages.length ? (
        <div className="ocr-actions">
          <button className="primary-button" type="button" onClick={() => void copyAll()}>Copy all text</button>
          {resultUrl ? <a className="secondary-button ocr-download" href={resultUrl} download={`${downloadBase(file?.name ?? "document")}.txt`}>Download .txt</a> : null}
        </div>
      ) : null}
      {phase !== "done" ? <button className="primary-button" type="button" disabled={!file || isBusy} onClick={() => void extractText()}>{isBusy ? "Extracting text…" : "Extract text from scan"}</button> : null}
      {copyMessage ? <p className="message" role="status" aria-live="polite">{copyMessage}</p> : null}
      {pages.length ? (
        <div className="ocr-results">
          <h2>Extracted text by page</h2>
          {phase === "done" && !pages.some((page) => page.text.trim()) ? <p className="message" role="status">No text was recognised. Try a clearer scan with printed English text, or use <a href="/pdf-to-text">Extract text</a> if the PDF already contains selectable text.</p> : <p>Check the recognised text against the scan before using it.</p>}
          {pages.map((page) => (
            <article className="ocr-page" key={page.page}>
              <div className="ocr-page-heading"><h3>Page {page.page}</h3><span>{confidenceLabel(page.confidence)}</span></div>
              <textarea aria-label={`Extracted text from page ${page.page}`} readOnly value={page.text} rows={Math.min(18, Math.max(5, page.text.split("\n").length + 2))} />
              <button className="secondary-button" type="button" onClick={() => void copyPage(page)}>Copy page {page.page}</button>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
