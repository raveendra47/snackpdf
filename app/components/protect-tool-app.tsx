"use client";

import { useClientReady } from "./use-client-ready";

import { useEffect, useRef, useState } from "react";
import { lockPdf, type PdfEncryptionOptions } from "../lib/pdf-encrypt";

type ProtectPhase = "idle" | "processing" | "done" | "error";

interface PermissionSetting {
  key: keyof Pick<PdfEncryptionOptions, "allowPrinting" | "allowModifying" | "allowCopying" | "allowAnnotating" | "allowFillingForms" | "allowExtraction" | "allowAssembly" | "allowHighQualityPrint">;
  label: string;
  detail: string;
}

const PERMISSIONS: PermissionSetting[] = [
  { key: "allowPrinting", label: "Printing", detail: "Allow the reader to print the document." },
  { key: "allowHighQualityPrint", label: "High-quality printing", detail: "Allow the reader to print at full quality." },
  { key: "allowCopying", label: "Copying text and images", detail: "Allow selecting and copying content." },
  { key: "allowModifying", label: "Modifying content", detail: "Allow changing the document content." },
  { key: "allowAnnotating", label: "Adding annotations", detail: "Allow comments and annotations." },
  { key: "allowFillingForms", label: "Filling existing forms", detail: "Allow entering values in existing form fields." },
  { key: "allowExtraction", label: "Accessibility extraction", detail: "Allow assistive technology to extract content." },
  { key: "allowAssembly", label: "Document assembly", detail: "Allow inserting, deleting or rearranging pages." },
];

const DEFAULT_PERMISSIONS: PdfEncryptionOptions = {
  allowPrinting: true,
  allowHighQualityPrint: false,
  allowCopying: false,
  allowModifying: false,
  allowAnnotating: false,
  allowFillingForms: true,
  allowExtraction: true,
  allowAssembly: false,
};

function validatePdf(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".pdf") || (file.type && ![
    "application/pdf",
    "application/x-pdf",
  ].includes(file.type))) return "Choose a PDF file.";
  if (!file.size) return "This file is empty.";
  if (file.size > 500 * 1024 * 1024) return "This file is too large to process safely in this browser.";
  return null;
}

function downloadBase(filename: string): string {
  const base = filename.replace(/\.pdf$/i, "").replace(/[^a-zA-Z0-9._ -]+/g, "-").replace(/[ ._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return base || "document";
}

export function ProtectToolApp() {
  const clientReady = useClientReady();
  const [file, setFile] = useState<File | null>(null);
  const [userPassword, setUserPassword] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [permissions, setPermissions] = useState<PdfEncryptionOptions>(DEFAULT_PERMISSIONS);
  const [phase, setPhase] = useState<ProtectPhase>("idle");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
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
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current = null;
    setResultUrl(null);
    setError(validation ?? "");
    setPhase(validation ? "error" : "idle");
    setStatus("");
    if (!validation) setFile(candidate);
    if (inputRef.current) inputRef.current.value = "";
  };

  const togglePermission = (key: PermissionSetting["key"]) => {
    if (isBusy) return;
    setPermissions((current) => ({ ...current, [key]: !current[key] }));
  };

  const protect = async () => {
    const password = userPassword;
    if (!file || isBusy) return;
    if (!password.trim()) {
      setError("Enter an open password. Anyone with this password can open the protected PDF.");
      setPhase("error");
      return;
    }
    setPhase("processing");
    setError("");
    setStatus("Encrypting the PDF locally with AES-256");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const encrypted = await lockPdf(bytes, password, {
        ...permissions,
        ownerPassword: ownerPassword || password,
      });
      const output = encrypted.buffer.slice(encrypted.byteOffset, encrypted.byteOffset + encrypted.byteLength) as ArrayBuffer;
      const nextUrl = URL.createObjectURL(new Blob([output], { type: "application/pdf" }));
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = nextUrl;
      setResultUrl(nextUrl);
      setStatus("");
      setPhase("done");
    } catch (failure) {
      setStatus("");
      setPhase("error");
      setError(failure instanceof Error ? failure.message : "The PDF could not be password protected locally.");
    } finally {
      setUserPassword("");
      setOwnerPassword("");
    }
  };

  const startAgain = () => {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current = null;
    setResultUrl(null);
    setFile(null);
    setUserPassword("");
    setOwnerPassword("");
    setError("");
    setStatus("");
    setPhase("idle");
  };

  return (
    <section className="protect-workspace" aria-labelledby="protect-workspace-heading">
      <h2 id="protect-workspace-heading">Protect a PDF with AES-256</h2>
      <div className="file-area">
        <label className="file-label" htmlFor="protect-pdf-file">Choose PDF</label>
        <input ref={inputRef} id="protect-pdf-file" className="file-input" type="file" disabled={!clientReady || isBusy} aria-describedby={error ? "protect-error" : undefined} accept="application/pdf,.pdf" aria-label="Choose a PDF file" onChange={(event) => chooseFile(event.target.files?.[0])} />
        <p>Files and passwords stay in this browser tab. The original file is not changed.</p>
      </div>
      {file ? <p className="ocr-selected-file"><strong>Selected:</strong> {file.name} · {Math.round(file.size / 1024)} KB</p> : null}
      <div className="password-fields">
        <label className="password-field" htmlFor="protect-user-password">
          <span><strong>Open password</strong><small>Required to open the encrypted PDF.</small></span>
          <input id="protect-user-password" type="password" value={userPassword} onChange={(event) => setUserPassword(event.target.value)} disabled={isBusy} autoComplete="new-password" />
        </label>
        <label className="password-field" htmlFor="protect-owner-password">
          <span><strong>Owner password</strong><small>Optional. Used to manage permissions; blank uses the open password.</small></span>
          <input id="protect-owner-password" type="password" value={ownerPassword} onChange={(event) => setOwnerPassword(event.target.value)} disabled={isBusy} autoComplete="new-password" />
        </label>
      </div>
      <fieldset className="settings permission-settings">
        <legend>Reader permissions</legend>
        <p className="setting-note">These permissions are advisory. Conforming PDF readers may honour them, but a determined tool can ignore them. Use a real open password if the content must stay confidential.</p>
        {PERMISSIONS.map((permission) => (
          <label key={permission.key}>
            <input type="checkbox" checked={Boolean(permissions[permission.key])} onChange={() => togglePermission(permission.key)} disabled={isBusy} />
            <span><strong>{permission.label}</strong><small>{permission.detail}</small></span>
          </label>
        ))}
      </fieldset>
      <p className="protect-warning"><strong>Encryption is not redaction.</strong> Anyone with the open password can see everything in the PDF, including content that was only covered. To remove content, use <a href="/redact-pdf">Redact PDF content</a>.</p>
      {status ? <div className="message status-message" role="status" aria-live="polite"><strong>{status}</strong></div> : null}
      {error ? <div id="protect-error" className="message error-message" role="alert">{error}</div> : null}
      {resultUrl ? (
        <section className="results" aria-labelledby="protect-done-heading">
          <h2 id="protect-done-heading">PDF protected</h2>
          <p>Open the downloaded file in another PDF viewer and enter the open password. Text remains selectable after it opens; permissions do not replace a password.</p>
          <a className="download-link" href={resultUrl} download={`${downloadBase(file?.name ?? "document")}-protected.pdf`}>Download protected PDF</a>
        </section>
      ) : null}
      <button className="primary-button" type="button" disabled={!file || !userPassword.trim() || isBusy} onClick={() => void protect()}>{isBusy ? "Protecting PDF…" : "Protect PDF"}</button>
      {resultUrl ? <button className="secondary-button" type="button" onClick={startAgain}>Start again</button> : null}
    </section>
  );
}
