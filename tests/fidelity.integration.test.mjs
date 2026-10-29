import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { inflateSync } from "node:zlib";
import loadGhostscript from "@okathira/ghostpdl-wasm";
import { buildCommand, buildCountCommand, inputName } from "../public/engine/commands.js";

const wasmBinary = new Uint8Array(await readFile(new URL("../node_modules/@okathira/ghostpdl-wasm/dist/gs.wasm", import.meta.url)));
const fidelityPostScript = new Uint8Array(await readFile(new URL("fixtures/fidelity.ps", import.meta.url)));
const scannedPostScript = new Uint8Array(await readFile(new URL("fixtures/scanned.ps", import.meta.url)));
const compressionPostScript = new Uint8Array(await readFile(new URL("fixtures/compression.ps", import.meta.url)));

async function moduleWithLogs() {
  const logs = [];
  const engineInstance = await loadGhostscript({
    wasmBinary,
    noExitRuntime: true,
    print: (line) => logs.push(String(line)),
    printErr: (line) => logs.push(String(line)),
  });
  return { engineInstance, logs };
}

async function runNamed(args, inputs, outputPattern) {
  const { engineInstance, logs } = await moduleWithLogs();
  for (const [name, bytes] of Object.entries(inputs)) engineInstance.FS.writeFile(name, bytes);
  const status = engineInstance.callMain([...args]);
  assert.equal(status, 0, logs.join("\n"));
  const names = engineInstance.FS.readdir("/").filter((name) => outputPattern.test(name)).sort();
  assert.ok(names.length > 0, logs.join("\n"));
  return names.map((name) => ({
    name,
    bytes: new Uint8Array(engineInstance.FS.readFile(name, { encoding: "binary" })).slice(),
  }));
}

async function pdfFromPostScript(bytes) {
  const [output] = await runNamed([
    "-dSAFER", "-dBATCH", "-dNOPAUSE", "-dNOPROMPT",
    "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.7", "-dAutoRotatePages=/None",
    "-dOmitInfoDate=true", "-dOmitID=true", "-dOmitXMP=true",
    "--permit-file-read=fixture.ps", "--permit-file-write=fixture.pdf",
    "-sOutputFile=fixture.pdf", "fixture.ps",
  ], { "fixture.ps": bytes }, /^fixture\.pdf$/);
  return output.bytes;
}

async function runPdfPlan(plan, pdf) {
  const { engineInstance, logs } = await moduleWithLogs();
  engineInstance.FS.writeFile(inputName(0), pdf);
  const status = engineInstance.callMain([...plan.args]);
  assert.equal(status, 0, logs.join("\n"));
  const names = plan.outputPattern
    ? engineInstance.FS.readdir("/").filter((name) => plan.outputPattern.test(name)).sort()
    : plan.outputNames;
  return names.map((name) => new Uint8Array(engineInstance.FS.readFile(name, { encoding: "binary" })).slice());
}

async function inspectPdf(pdf) {
  const { engineInstance, logs } = await moduleWithLogs();
  engineInstance.FS.writeFile(inputName(0), pdf);
  const status = engineInstance.callMain(buildCountCommand());
  assert.equal(status, 0, logs.join("\n"));
  const pageCount = Number(logs.find((line) => /^\d+$/.test(line.trim()))?.trim());
  const boxes = logs.filter((line) => /^\[.*\]$/.test(line.trim()));
  return { pageCount, boxes };
}

async function renderPdf(pdf) {
  const outputs = await runNamed([
    "-dSAFER", "-dBATCH", "-dNOPAUSE", "-dNOPROMPT",
    "-sDEVICE=png16m", "-r72", "-dTextAlphaBits=4", "-dGraphicsAlphaBits=4",
    `--permit-file-read=${inputName(0)}`, "--permit-file-write=render-*.png",
    "-sOutputFile=render-%03d.png", inputName(0),
  ], { [inputName(0)]: pdf }, /^render-\d{3,}\.png$/);
  return outputs.map(({ bytes }) => parsePng(bytes));
}

function parsePng(bytes) {
  assert.deepEqual([...bytes.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let width = 0;
  let height = 0;
  const dataChunks = [];
  while (offset < bytes.length) {
    const length = view.getUint32(offset);
    const type = new TextDecoder().decode(bytes.slice(offset + 4, offset + 8));
    const data = bytes.slice(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      const header = new DataView(data.buffer, data.byteOffset, data.byteLength);
      width = header.getUint32(0);
      height = header.getUint32(4);
      assert.equal(data[8], 8, "expected 8-bit PNG");
      assert.equal(data[9], 2, "expected RGB PNG");
      assert.equal(data[12], 0, "expected non-interlaced PNG");
    }
    if (type === "IDAT") dataChunks.push(data);
    offset += 12 + length;
    if (type === "IEND") break;
  }
  const compressed = Buffer.concat(dataChunks.map((chunk) => Buffer.from(chunk)));
  const raw = inflateSync(compressed);
  const stride = width * 3;
  const pixels = new Uint8Array(stride * height);
  let sourceOffset = 0;
  for (let row = 0; row < height; row += 1) {
    const filter = raw[sourceOffset++];
    for (let column = 0; column < stride; column += 1) {
      const value = raw[sourceOffset++];
      const left = column >= 3 ? pixels[row * stride + column - 3] : 0;
      const above = row > 0 ? pixels[(row - 1) * stride + column] : 0;
      const upperLeft = row > 0 && column >= 3 ? pixels[(row - 1) * stride + column - 3] : 0;
      let reconstructed = value;
      if (filter === 1) reconstructed += left;
      else if (filter === 2) reconstructed += above;
      else if (filter === 3) reconstructed += Math.floor((left + above) / 2);
      else if (filter === 4) reconstructed += paeth(left, above, upperLeft);
      else assert.equal(filter, 0, `unsupported PNG filter ${filter}`);
      pixels[row * stride + column] = reconstructed & 255;
    }
  }
  return { width, height, pixels };
}

function paeth(left, above, upperLeft) {
  const prediction = left + above - upperLeft;
  const leftDistance = Math.abs(prediction - left);
  const aboveDistance = Math.abs(prediction - above);
  const upperLeftDistance = Math.abs(prediction - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  if (aboveDistance <= upperLeftDistance) return above;
  return upperLeft;
}

function meanAbsoluteDifference(left, right) {
  assert.equal(left.width, right.width);
  assert.equal(left.height, right.height);
  assert.equal(left.pixels.length, right.pixels.length);
  let difference = 0;
  for (let index = 0; index < left.pixels.length; index += 1) {
    difference += Math.abs(left.pixels[index] - right.pixels[index]);
  }
  return difference / left.pixels.length;
}

test("representative fixture is deterministic and exposes mixed page boxes", async () => {
  const first = await pdfFromPostScript(fidelityPostScript);
  const second = await pdfFromPostScript(fidelityPostScript);
  assert.equal(createHash("sha256").update(first).digest("hex"), createHash("sha256").update(second).digest("hex"));
  const inspected = await inspectPdf(first);
  assert.equal(inspected.pageCount, 3);
  assert.equal(inspected.boxes.length, 3);
  assert.notEqual(inspected.boxes[0], inspected.boxes[1]);
  assert.notEqual(inspected.boxes[1], inspected.boxes[2]);
});

test("rewrite profiles stay within the approved visual threshold", async () => {
  const source = await pdfFromPostScript(fidelityPostScript);
  const sourcePages = await renderPdf(source);
  for (const profile of ["light", "balanced", "smallest"]) {
    const [rewritten] = await runPdfPlan(buildCommand("compress", 1, { profile }), source);
    assert.equal((await inspectPdf(rewritten)).pageCount, 3);
    const outputPages = await renderPdf(rewritten);
    assert.equal(outputPages.length, sourcePages.length);
    const differences = outputPages.map((page, index) => meanAbsoluteDifference(sourcePages[index], page));
    assert.ok(Math.max(...differences) <= 3, `${profile} visual difference ${differences.join(", ")}`);
  }
});

test("compression profiles meet deterministic size and fidelity benchmarks", async () => {
  const source = await pdfFromPostScript(compressionPostScript);
  const [sourcePage] = await renderPdf(source);
  const limits = { light: 5, balanced: 8, smallest: 14 };
  const metrics = [];

  for (const profile of ["light", "balanced", "smallest"]) {
    const [first] = await runPdfPlan(buildCommand("compress", 1, { profile }), source);
    const [second] = await runPdfPlan(buildCommand("compress", 1, { profile }), source);
    assert.equal(createHash("sha256").update(first).digest("hex"), createHash("sha256").update(second).digest("hex"));
    assert.equal((await inspectPdf(first)).pageCount, 1);
    const [rendered] = await renderPdf(first);
    const difference = meanAbsoluteDifference(sourcePage, rendered);
    assert.ok(difference <= limits[profile], `${profile} mean visual difference ${difference} exceeded ${limits[profile]}`);
    metrics.push({ profile, bytes: first.byteLength, difference });
  }

  assert.ok(metrics[0].bytes > metrics[1].bytes, JSON.stringify(metrics));
  assert.ok(metrics[1].bytes > metrics[2].bytes, JSON.stringify(metrics));
  assert.ok(metrics[0].difference <= metrics[1].difference + 0.5, JSON.stringify(metrics));
  assert.ok(metrics[1].difference <= metrics[2].difference + 0.5, JSON.stringify(metrics));
});

test("grayscale output renders with equal RGB channels", async () => {
  const source = await pdfFromPostScript(fidelityPostScript);
  const sourcePages = await renderPdf(source);
  const sourceHasColour = sourcePages.some(({ pixels }) => {
    for (let index = 0; index < pixels.length; index += 3) {
      if (pixels[index] !== pixels[index + 1] || pixels[index + 1] !== pixels[index + 2]) return true;
    }
    return false;
  });
  assert.equal(sourceHasColour, true);

  const [grayscale] = await runPdfPlan(buildCommand("grayscale", 1, {}), source);
  const grayscalePages = await renderPdf(grayscale);
  for (const { pixels } of grayscalePages) {
    for (let index = 0; index < pixels.length; index += 3) {
      assert.ok(Math.abs(pixels[index] - pixels[index + 1]) <= 1);
      assert.ok(Math.abs(pixels[index + 1] - pixels[index + 2]) <= 1);
    }
  }
});

test("image-only fixture produces honest empty stored-text output", async () => {
  const scanned = await pdfFromPostScript(scannedPostScript);
  const [textOutput] = await runPdfPlan(buildCommand("pdf-to-text", 1, {}), scanned);
  assert.equal(new TextDecoder().decode(textOutput).trim(), "");
});
