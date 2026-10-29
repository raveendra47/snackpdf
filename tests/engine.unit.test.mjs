import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCommand,
  buildSplitCommand,
  complementPages,
  inputName,
  pageFileName,
  parsePageSelection,
  sanitiseDownloadBase,
} from "../public/engine/commands.js";
import { mapEngineFailure } from "../public/engine/errors.js";

test("parses page selections and preserves requested order", () => {
  assert.deepEqual(parsePageSelection("1-3, 6,8", 8), [1, 2, 3, 6, 8]);
  assert.deepEqual(parsePageSelection("3,1,3", 4), [3, 1, 3]);
  assert.throws(() => parsePageSelection("4-2", 5), /low to high/);
  assert.throws(() => parsePageSelection("1,9", 8), /between 1 and 8/);
  assert.throws(() => parsePageSelection("1;2", 8), /page numbers/);
});

test("calculates page complements and keeps at least one page", () => {
  assert.deepEqual(complementPages([2, 4], 5), [1, 3, 5]);
  assert.throws(() => complementPages([1, 2], 2), /At least one page/);
});

test("creates deterministic internal and output names", () => {
  assert.equal(inputName(0), "input-001.pdf");
  assert.equal(inputName(11), "input-012.pdf");
  assert.equal(pageFileName(7, "png"), "page-007.png");
  assert.equal(sanitiseDownloadBase("  Résumé (final)!!.pdf"), "R-sum-final");
  assert.equal(sanitiseDownloadBase(".pdf"), "document");
});

test("builds fixed allowlisted argument arrays", () => {
  const plan = buildCommand("compress", 1, { profile: "balanced" });
  assert.ok(plan.args.includes("-sDEVICE=pdfwrite"));
  assert.ok(plan.args.includes("-dColorImageResolution=150"));
  assert.ok(plan.args.includes("-dOmitInfoDate=true"));
  assert.ok(plan.args.includes("-dOmitID=true"));
  assert.ok(plan.args.includes("--permit-file-read=input-001.pdf"));
  assert.equal(plan.args.at(-1), "input-001.pdf");
  assert.deepEqual(plan.outputNames, ["output.pdf"]);
});

test("validates command options before arguments are created", () => {
  assert.throws(() => buildCommand("merge", 1, {}), /at least two/);
  assert.throws(() => buildCommand("pdf-to-jpg", 1, { resolution: 72 }), /not valid/);
  assert.throws(() => buildCommand("unlock", 1, { password: "line\nbreak" }), /Enter the PDF password/);
  assert.throws(() => buildSplitCommand(0), /not valid/);
});

test("pins UTF-8 text output", () => {
  const plan = buildCommand("pdf-to-text", 1, {});
  assert.ok(plan.args.includes("-dTextFormat=3"));
});

test("maps internal failures to safe messages", () => {
  assert.equal(mapEngineFailure("Password did not match").code, "wrong-password");
  assert.equal(mapEngineFailure("not a PDF file").code, "invalid-pdf");
  assert.equal(mapEngineFailure("Out of memory").code, "out-of-memory");
  assert.equal(mapEngineFailure("unknown internal detail").message, "The resulting file could not be created.");
});
