import {
  AlreadyEncryptedError,
  PasswordEncodingError,
  encryptPDF,
} from "./vendor/pdf-encrypt/index.mjs";

export interface PdfEncryptionOptions {
  ownerPassword?: string;
  allowPrinting: boolean;
  allowModifying: boolean;
  allowCopying: boolean;
  allowAnnotating: boolean;
  allowFillingForms: boolean;
  allowExtraction: boolean;
  allowAssembly: boolean;
  allowHighQualityPrint: boolean;
}

export { AlreadyEncryptedError, PasswordEncodingError };

/** Encrypt with AES-256 only; never silently downgrade to RC4. */
export async function lockPdf(
  pdfBytes: Uint8Array,
  userPassword: string,
  options: PdfEncryptionOptions,
): Promise<Uint8Array> {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    throw new Error("AES-256 password protection requires a secure HTTPS context.");
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error("This browser does not provide the Web Crypto API required for AES-256.");
  }
  return encryptPDF(pdfBytes, userPassword, {
    ...options,
    algorithm: "AES-256",
  });
}
