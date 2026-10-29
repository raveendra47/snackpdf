/** Turn known local parser errors into a next step without exposing parser traces. */
export function pdfReadError(failure: unknown, fallback: string): string {
  const message = failure instanceof Error ? failure.message : "";
  if (/password|encrypted/i.test(message)) return "This PDF is password protected. Use Unlock PDF with a password you know, then choose the unlocked copy here.";
  if (/invalid pdf|pdf header|failed to parse pdf|invalid.*structure/i.test(message)) return "This PDF could not be read. Check that it opens in a PDF viewer, or choose another file. The original is unchanged.";
  return message || fallback;
}
