"use client";

import { useClientReady } from "./use-client-ready";

import { pdfReadError } from "../lib/pdf-read-error";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { PagePositionControls, type PagePosition } from "./page-position-controls";

type FieldKind = "text" | "checkbox" | "dropdown" | "radio" | "option" | "unsupported";

interface EditableField {
  name: string;
  kind: FieldKind;
  value: string;
  checked: boolean;
  options: string[];
  readOnly: boolean;
}

interface PagePreview {
  page: number;
  width: number;
  height: number;
  imageUrl: string;
}

interface PlacedAnnotation {
  id: number;
  page: number;
  type: "text" | "checkbox" | "date";
  value: string;
  x: number;
  y: number;
}

interface FieldApi {
  getName(): string;
  getText?(): string | undefined;
  setText?(value: string): void;
  isChecked?(): boolean;
  check?(): void;
  uncheck?(): void;
  getSelected?(): string | string[];
  getOptions?(): string[];
  select?(value: string | string[]): void;
  clear?(): void;
  isEditable?(): boolean;
  isMultiselect?(): boolean;
  isReadOnly?(): boolean;
}

interface FormApi {
  getFields(): FieldApi[];
  getTextField(name: string): FieldApi;
  getCheckBox(name: string): FieldApi;
  getDropdown(name: string): FieldApi;
  getRadioGroup(name: string): FieldApi;
  getOptionList(name: string): FieldApi;
  updateFieldAppearances(): void;
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

function selectedValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function fieldKind(field: FieldApi): FieldKind {
  const typeName = field.constructor.name;
  if (typeName === "PDFTextField") return "text";
  if (typeName === "PDFCheckBox") return "checkbox";
  if (typeName === "PDFDropdown") return "dropdown";
  if (typeName === "PDFRadioGroup") return "radio";
  if (typeName === "PDFOptionList") return "option";
  if (typeof field.isChecked === "function") return "checkbox";
  if (typeof field.getText === "function" && typeof field.setText === "function") return "text";
  if (typeof field.isEditable === "function") return "dropdown";
  if (typeof field.isMultiselect === "function") return "option";
  if (typeof field.getOptions === "function" && typeof field.select === "function") return "radio";
  return "unsupported";
}

function fieldSnapshot(field: FieldApi): EditableField {
  const kind = fieldKind(field);
  return {
    name: field.getName(),
    kind,
    value: kind === "text" ? field.getText?.() ?? "" : selectedValue(field.getSelected?.()),
    checked: kind === "checkbox" ? Boolean(field.isChecked?.()) : false,
    options: kind === "dropdown" || kind === "radio" || kind === "option" ? field.getOptions?.() ?? [] : [],
    readOnly: Boolean(field.isReadOnly?.()),
  };
}

function pointFromEvent(event: ReactPointerEvent<HTMLDivElement>): { x: number; y: number } {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
  };
}

export function FormToolApp() {
  const clientReady = useClientReady();
  const [file, setFile] = useState<File | null>(null);
  const [fields, setFields] = useState<EditableField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [previews, setPreviews] = useState<PagePreview[]>([]);
  const [annotations, setAnnotations] = useState<PlacedAnnotation[]>([]);
  const [annotationType, setAnnotationType] = useState<PlacedAnnotation["type"]>("text");
  const [annotationValue, setAnnotationValue] = useState("");
  const [phase, setPhase] = useState<"idle" | "reading" | "saving" | "done" | "error">("idle");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [inputRef] = useState(() => ({ current: null as HTMLInputElement | null }));
  const nextAnnotationId = useRef(1);
  const isBusy = phase === "reading" || phase === "saving";

  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("snackpdf:job-state", { detail: { active: isBusy } }));
    return () => { window.dispatchEvent(new CustomEvent("snackpdf:job-state", { detail: { active: false } })); };
  }, [isBusy]);

  const chooseFile = async (candidate: File | undefined) => {
    if (!candidate || isBusy) return;
    const validation = validatePdf(candidate);
    if (validation) {
      setError(validation);
      setPhase("error");
      return;
    }
    setFile(candidate);
    setFields([]);
    setValues({});
    setChecked({});
    setPreviews([]);
    setAnnotations([]);
    setResultUrl(null);
    setError("");
    setPhase("reading");
    setStatus("Inspecting the PDF locally");
    try {
      const [{ PDFDocument }, { getDocument, GlobalWorkerOptions }] = await Promise.all([
        import("pdf-lib"),
        import("pdfjs-dist/build/pdf.min.mjs"),
      ]);
      const bytes = new Uint8Array(await candidate.arrayBuffer());
      const pdfDocument = await PDFDocument.load(bytes);
      const form = pdfDocument.getForm() as unknown as FormApi;
      const snapshots = form.getFields().map(fieldSnapshot);
      if (snapshots.some((field) => field.kind !== "unsupported")) {
        setFields(snapshots);
        setValues(Object.fromEntries(snapshots.filter((field) => field.kind !== "checkbox").map((field) => [field.name, field.value])));
        setChecked(Object.fromEntries(snapshots.filter((field) => field.kind === "checkbox").map((field) => [field.name, field.checked])));
        setStatus("");
        setPhase("idle");
        return;
      }
      GlobalWorkerOptions.workerSrc = "/ocr/pdf.worker.min.mjs";
      const pdf = await getDocument({ data: bytes, useWorkerFetch: false, isOffscreenCanvasSupported: false, useWasm: false }).promise;
      if (pdf.numPages < 1 || pdf.numPages > 50) throw new Error("This PDF has an unsupported number of pages. Choose a PDF with 1 to 50 pages.");
      const next: PagePreview[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        setStatus(`Rendering page ${pageNumber} of ${pdf.numPages}`);
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        const canvas = window.document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("This browser could not create a page preview.");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport }).promise;
        next.push({ page: pageNumber, width: viewport.width, height: viewport.height, imageUrl: canvas.toDataURL("image/jpeg", 0.82) });
      }
      setPreviews(next);
      setStatus("");
      setPhase("idle");
    } catch (failure) {
      setFields([]);
      setPreviews([]);
      setStatus("");
      setPhase("error");
      setError(pdfReadError(failure, "The PDF could not be inspected locally."));
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const updateField = (field: EditableField, value: string) => {
    if (field.readOnly) return;
    setResultUrl(null);
    setValues((current) => ({ ...current, [field.name]: value }));
  };

  const savePdf = async () => {
    if (!file || isBusy || (!fields.length && !annotations.length)) return;
    setPhase("saving");
    setError("");
    setStatus(fields.length ? "Updating form fields locally" : "Adding annotations locally");
    try {
      const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdfDocument = await PDFDocument.load(bytes);
      if (fields.length) {
        const form = pdfDocument.getForm() as unknown as FormApi;
        for (const field of fields) {
          if (field.readOnly) continue;
          if (field.kind === "text") form.getTextField(field.name).setText?.(values[field.name] ?? "");
          if (field.kind === "checkbox") {
            if (checked[field.name]) form.getCheckBox(field.name).check?.();
            else form.getCheckBox(field.name).uncheck?.();
          }
          if (field.kind === "dropdown") {
            const value = values[field.name] ?? "";
            if (value) form.getDropdown(field.name).select?.(value);
            else form.getDropdown(field.name).clear?.();
          }
          if (field.kind === "radio") {
            const value = values[field.name] ?? "";
            if (value) form.getRadioGroup(field.name).select?.(value);
            else form.getRadioGroup(field.name).clear?.();
          }
          if (field.kind === "option") {
            const value = values[field.name] ?? "";
            if (value) form.getOptionList(field.name).select?.(value);
            else form.getOptionList(field.name).clear?.();
          }
        }
        form.updateFieldAppearances();
      } else {
        const output = await PDFDocument.create();
        const pages = await output.copyPages(pdfDocument, pdfDocument.getPageIndices());
        pages.forEach((page) => output.addPage(page));
        const font = await output.embedFont(StandardFonts.Helvetica);
        for (const annotation of annotations) {
          const page = output.getPage(annotation.page - 1);
          const pageHeight = page.getHeight();
          const x = annotation.x * page.getWidth();
          const y = pageHeight - annotation.y * pageHeight;
          if (annotation.type === "checkbox") {
            const size = 13;
            page.drawRectangle({ x, y: y - size, width: size, height: size, borderColor: rgb(0.15, 0.15, 0.15), borderWidth: 1, color: rgb(1, 1, 1) });
            page.drawLine({ start: { x: x + 2, y: y - 7 }, end: { x: x + 6, y: y - 11 }, thickness: 1.4, color: rgb(0.1, 0.1, 0.1) });
            page.drawLine({ start: { x: x + 6, y: y - 11 }, end: { x: x + 12, y: y - 2 }, thickness: 1.4, color: rgb(0.1, 0.1, 0.1) });
          } else {
            page.drawText(annotation.value || (annotation.type === "date" ? "Date" : "Text"), { x, y: y - 10, size: 11, font, color: rgb(0.05, 0.05, 0.05), maxWidth: Math.max(80, page.getWidth() - x - 18) });
          }
        }
        const outputBytes = await output.save();
        const outputBuffer = outputBytes.buffer.slice(outputBytes.byteOffset, outputBytes.byteOffset + outputBytes.byteLength) as ArrayBuffer;
        const outputBlob = new Blob([outputBuffer], { type: "application/pdf" });
        setResultUrl(URL.createObjectURL(outputBlob));
      }
      if (fields.length) {
        const outputBytes = await pdfDocument.save();
        const outputBuffer = outputBytes.buffer.slice(outputBytes.byteOffset, outputBytes.byteOffset + outputBytes.byteLength) as ArrayBuffer;
        setResultUrl(URL.createObjectURL(new Blob([outputBuffer], { type: "application/pdf" })));
      }
      setStatus("");
      setPhase("done");
    } catch (failure) {
      setStatus("");
      setPhase("error");
      setError(failure instanceof Error && /WinAnsi|encode/.test(failure.message) ? "This PDF font cannot display one or more entered characters. Your entries are still here. Use a PDF editor with a suitable font for this text." : failure instanceof Error ? `The filled PDF could not be saved. ${failure.message} Your entries are still here; correct them and retry.` : "The filled PDF could not be saved locally. Your entries are still here; try again.");
    }
  };

  const addAnnotation = (page: number, point: Pick<PagePosition, "x" | "y">) => {
    if (isBusy) return;
    if (annotationType !== "checkbox" && !annotationValue.trim()) {
      setError("Enter annotation text before placing it on the page.");
      return;
    }
    setError("");
    setResultUrl(null);
    setAnnotations((current) => [...current, { id: nextAnnotationId.current++, page, type: annotationType, value: annotationType === "checkbox" ? "" : annotationValue.trim(), x: point.x, y: point.y }]);
  };
  const placeAnnotation = (page: number, event: ReactPointerEvent<HTMLDivElement>) => addAnnotation(page, pointFromEvent(event));

  return (
    <section className="form-workspace" aria-labelledby="form-workspace-heading">
      <h2 id="form-workspace-heading">Fill a PDF form</h2>
      <div className="file-area">
        <label className="file-label" htmlFor="fill-pdf-file">Choose PDF form</label>
        <input ref={inputRef} id="fill-pdf-file" className="file-input" type="file" disabled={!clientReady || isBusy} aria-describedby={error ? "form-error" : undefined} accept="application/pdf,.pdf" aria-label="Choose PDF form" onChange={(event) => void chooseFile(event.target.files?.[0])} />
        <p>Files stay on this device. Existing form fields are filled directly; flat PDFs get positioned text, checkbox or date annotations.</p>
      </div>
      {file ? <p className="ocr-selected-file"><strong>Selected:</strong> {file.name} · {Math.round(file.size / 1024)} KB</p> : null}
      {status ? <div className="message status-message" role="status" aria-live="polite"><strong>{status}</strong></div> : null}
      {error ? <div id="form-error" className="message error-message" role="alert">{error}</div> : null}
      {fields.length ? (
        <div className="form-fields">
          <p className="setting-note">This PDF contains {fields.length} form {fields.length === 1 ? "field" : "fields"}. Unsupported field types are shown but left unchanged. The PDF font may not support every writing system; entries stay available if saving fails.</p>
          {fields.map((field) => (
            <label className="form-field" key={field.name}>
              <span><strong>{field.name}</strong>{field.readOnly ? " · read-only" : ""}</span>
              {field.kind === "checkbox" ? <input type="checkbox" checked={Boolean(checked[field.name])} disabled={field.readOnly || isBusy} onChange={(event) => { setResultUrl(null); setChecked((current) => ({ ...current, [field.name]: event.target.checked })); }} /> : null}
              {field.kind === "text" ? <textarea value={values[field.name] ?? ""} disabled={field.readOnly || isBusy} onChange={(event) => updateField(field, event.target.value)} rows={field.value.includes("\n") ? 3 : 1} /> : null}
              {(field.kind === "dropdown" || field.kind === "radio" || field.kind === "option") ? <select value={values[field.name] ?? ""} disabled={field.readOnly || isBusy} onChange={(event) => updateField(field, event.target.value)}><option value="">Choose an option</option>{field.options.map((option) => <option value={option} key={option}>{option}</option>)}</select> : null}
              {field.kind === "unsupported" ? <em>This field type is not editable in the browser.</em> : null}
            </label>
          ))}
        </div>
      ) : null}
      {!fields.length && previews.length ? (
        <>
          <fieldset className="settings inline-settings">
            <legend>Place an annotation</legend>
            {(["text", "checkbox", "date"] as const).map((type) => <label key={type}><input type="radio" name="annotation-type" value={type} checked={annotationType === type} onChange={() => setAnnotationType(type)} disabled={isBusy} /><span>{type[0].toUpperCase() + type.slice(1)}</span></label>)}
            {annotationType !== "checkbox" ? <input className="text-input" aria-label="Annotation text" placeholder={annotationType === "date" ? "Enter date" : "Enter text"} value={annotationValue} onChange={(event) => setAnnotationValue(event.target.value)} disabled={isBusy} maxLength={160} /> : null}
            <p className="setting-note">Click a page where the annotation should appear, or use its position controls. This creates a static mark, not a new interactive AcroForm field.</p>
          </fieldset>
          <div className="form-pages">
            {previews.map((page) => (
              <article className="form-page" key={page.page}>
                <div className="redaction-page-heading"><h3>Page {page.page}</h3><span>{annotations.filter((item) => item.page === page.page).length} placed</span></div>
                <div className="form-surface" onPointerUp={(event) => placeAnnotation(page.page, event)}>
                  <img src={page.imageUrl} alt={`Page ${page.page} preview`} draggable="false" />
                  {annotations.filter((item) => item.page === page.page).map((item) => <span className={`form-annotation form-annotation-${item.type}`} style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%` }} key={item.id}>{item.type === "checkbox" ? "✓" : item.value || item.type}</span>)}
                </div>
                <PagePositionControls page={page.page} disabled={isBusy || (annotationType !== "checkbox" && !annotationValue.trim())} onAdd={(position) => addAnnotation(page.page, position)} />
                <ul className="annotation-list">{annotations.filter((item) => item.page === page.page).map((item, index) => <li key={item.id}><span>{item.type === "checkbox" ? "Checkbox" : item.value} · {Math.round(item.x * 100)}% from left, {Math.round(item.y * 100)}% from top</span><button type="button" disabled={isBusy} aria-label={`Remove annotation ${index + 1} from page ${page.page}`} onClick={(event) => { event.currentTarget.closest(".form-page")?.querySelector<HTMLButtonElement>(".position-controls button")?.focus(); setResultUrl(null); setAnnotations((current) => current.filter((annotation) => annotation.id !== item.id)); }}>Remove</button></li>)}</ul>
              </article>
            ))}
          </div>
        </>
      ) : null}
      {resultUrl ? (
        <section className="results" aria-labelledby="form-done-heading">
          <h2 id="form-done-heading">PDF saved</h2>
          <p>Reopen the downloaded PDF in a viewer and check every field or annotation before sending it.</p>
          <a className="download-link" href={resultUrl} download={`${downloadBase(file?.name ?? "document")}-filled.pdf`}>Download filled PDF</a>
        </section>
      ) : null}
      <button className="primary-button" type="button" disabled={!file || (!fields.length && !annotations.length) || isBusy} onClick={() => void savePdf()}>{phase === "reading" ? "Inspecting PDF…" : phase === "saving" ? "Saving filled PDF…" : "Save filled PDF"}</button>
    </section>
  );
}
