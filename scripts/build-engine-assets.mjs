import { build } from "esbuild";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const outputDirectory = new URL("../public/engine/", import.meta.url);
const packageDirectory = new URL(
  "../node_modules/@okathira/ghostpdl-wasm/dist/",
  import.meta.url,
);

await mkdir(outputDirectory, { recursive: true });
await build({
  entryPoints: [fileURLToPath(new URL("../src/engine/worker.ts", import.meta.url))],
  outfile: fileURLToPath(new URL("worker.js", outputDirectory)),
  bundle: true,
  platform: "browser",
  format: "esm",
  target: ["es2022", "safari16.4", "firefox115", "chrome110"],
  minify: true,
  sourcemap: false,
  legalComments: "none",
});

await build({
  entryPoints: [fileURLToPath(new URL("../src/engine/commands.ts", import.meta.url))],
  outfile: fileURLToPath(new URL("commands.js", outputDirectory)),
  bundle: true,
  platform: "neutral",
  format: "esm",
  target: "es2022",
  minify: false,
  sourcemap: false,
  legalComments: "none",
});

await build({
  entryPoints: [fileURLToPath(new URL("../src/engine/errors.ts", import.meta.url))],
  outfile: fileURLToPath(new URL("errors.js", outputDirectory)),
  bundle: true,
  platform: "neutral",
  format: "esm",
  target: "es2022",
  minify: false,
  sourcemap: false,
  legalComments: "none",
});

await copyFile(new URL("gs.js", packageDirectory), new URL("gs.js", outputDirectory));
await copyFile(new URL("gs.wasm", packageDirectory), new URL("gs.wasm", outputDirectory));

const files = ["worker.js", "commands.js", "errors.js", "gs.js", "gs.wasm"];
const checksums = {};
for (const file of files) {
  const bytes = await readFile(new URL(file, outputDirectory));
  checksums[file] = createHash("sha256").update(bytes).digest("hex");
}
await writeFile(
  new URL("checksums.json", outputDirectory),
  `${JSON.stringify({ engine: "Ghostscript 10.06.0", package: "@okathira/ghostpdl-wasm@1.1.0", files: checksums }, null, 2)}\n`,
);
