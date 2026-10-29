import { access, copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const targetRoot = fileURLToPath(new URL("../public/ocr/", import.meta.url));
const required = [
  ["node_modules/tesseract.js/dist/worker.min.js", "worker.min.js"],
  ["node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js", "core/tesseract-core-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "core/tesseract-core-simd-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js", "core/tesseract-core-relaxedsimd-lstm.wasm.js"],
  ["node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "pdf.worker.min.mjs"],
];

await mkdir(`${targetRoot}/core`, { recursive: true });
await mkdir(`${targetRoot}/lang`, { recursive: true });
for (const [source, target] of required) {
  await access(`${projectRoot}/${source}`);
  await copyFile(`${projectRoot}/${source}`, `${targetRoot}/${target}`);
}
await access(`${targetRoot}/lang/eng.traineddata.gz`);
console.log(`Prepared ${required.length} local OCR runtime assets and verified bundled English data.`);
