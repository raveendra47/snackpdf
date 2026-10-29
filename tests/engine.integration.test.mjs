import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import loadGhostscript from "@okathira/ghostpdl-wasm";
import {
  buildCommand,
  buildCountCommand,
  buildSplitCommand,
  inputName,
} from "../public/engine/commands.js";

const wasmBinary = new Uint8Array(await readFile(new URL("../node_modules/@okathira/ghostpdl-wasm/dist/gs.wasm", import.meta.url)));
const simple = new Uint8Array(await readFile(new URL("fixtures/simple.pdf", import.meta.url)));
const encrypted = new Uint8Array(await readFile(new URL("fixtures/encrypted.pdf", import.meta.url)));

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

async function runPlan(plan, inputs) {
  const { engineInstance, logs } = await moduleWithLogs();
  inputs.forEach((bytes, index) => engineInstance.FS.writeFile(inputName(index), bytes));
  const status = engineInstance.callMain([...plan.args]);
  assert.equal(status, 0, logs.join("\n"));
  const names = plan.outputPattern
    ? engineInstance.FS.readdir("/").filter((name) => plan.outputPattern.test(name)).sort()
    : plan.outputNames;
  assert.ok(names.length > 0, logs.join("\n"));
  return names.map((name) => ({
    name,
    bytes: new Uint8Array(engineInstance.FS.readFile(name, { encoding: "binary" })).slice(),
  }));
}

async function pageCount(bytes) {
  const { engineInstance, logs } = await moduleWithLogs();
  engineInstance.FS.writeFile(inputName(0), bytes);
  const status = engineInstance.callMain(buildCountCommand());
  assert.equal(status, 0, logs.join("\n"));
  const count = Number([...logs].reverse().find((line) => /^\d+$/.test(line.trim()))?.trim());
  assert.ok(Number.isSafeInteger(count) && count > 0, logs.join("\n"));
  return count;
}

function hashes(outputs) {
  return outputs.map(({ name, bytes }) => `${name}:${createHash("sha256").update(bytes).digest("hex")}`);
}

async function runThree(plan, inputs, label = "operation") {
  const first = await runPlan(plan, inputs);
  const second = await runPlan(plan, inputs);
  const third = await runPlan(plan, inputs);
  assert.deepEqual(hashes(first), hashes(second), `${label} run 1 and run 2 differ`);
  assert.deepEqual(hashes(second), hashes(third), `${label} run 2 and run 3 differ`);
  return first;
}

test("all shipped operations create deterministic outputs", async () => {
  const cases = [
    { name: "compress-light", plan: buildCommand("compress", 1, { profile: "light" }), inputs: [simple], pages: 2, magic: "%PDF-" },
    { name: "compress-balanced", plan: buildCommand("compress", 1, { profile: "balanced" }), inputs: [simple], pages: 2, magic: "%PDF-" },
    { name: "compress-smallest", plan: buildCommand("compress", 1, { profile: "smallest" }), inputs: [simple], pages: 2, magic: "%PDF-" },
    { name: "rebuild", plan: buildCommand("rebuild", 1, {}), inputs: [simple], pages: 2, magic: "%PDF-" },
    { name: "merge", plan: buildCommand("merge", 2, {}), inputs: [simple, simple], pages: 4, magic: "%PDF-" },
    ...[96, 150, 300].map((resolution) => ({ name: `jpg-${resolution}`, plan: buildCommand("pdf-to-jpg", 1, { resolution }), inputs: [simple], count: 2, bytes: [0xff, 0xd8, 0xff] })),
    ...[96, 150, 300].map((resolution) => ({ name: `png-${resolution}`, plan: buildCommand("pdf-to-png", 1, { resolution }), inputs: [simple], count: 2, bytes: [0x89, 0x50, 0x4e, 0x47] })),
    { name: "text", plan: buildCommand("pdf-to-text", 1, {}), inputs: [simple], count: 1, contains: "SnackPDF fixture page 1" },
    { name: "unlock", plan: buildCommand("unlock", 1, { password: "snackpdf" }), inputs: [encrypted], pages: 2, magic: "%PDF-" },
    { name: "grayscale", plan: buildCommand("grayscale", 1, {}), inputs: [simple], pages: 2, magic: "%PDF-" },
  ];

  for (const fixture of cases) {
    const outputs = await runThree(fixture.plan, fixture.inputs, fixture.name);
    if (fixture.count) assert.equal(outputs.length, fixture.count, fixture.name);
    if (fixture.magic) {
      assert.equal(new TextDecoder().decode(outputs[0].bytes.slice(0, fixture.magic.length)), fixture.magic, fixture.name);
      assert.equal(await pageCount(outputs[0].bytes), fixture.pages, fixture.name);
    }
    if (fixture.bytes) assert.deepEqual([...outputs[0].bytes.slice(0, fixture.bytes.length)], fixture.bytes, fixture.name);
    if (fixture.contains) assert.match(new TextDecoder().decode(outputs[0].bytes), new RegExp(fixture.contains), fixture.name);
  }
});

test("split creates one deterministic, reopenable PDF per page", async () => {
  for (let page = 1; page <= 2; page += 1) {
    const outputs = await runThree(buildSplitCommand(page), [simple]);
    assert.equal(outputs.length, 1);
    assert.equal(outputs[0].name, `page-00${page}.pdf`);
    assert.equal(await pageCount(outputs[0].bytes), 1);
  }
});

test("reordered pages are emitted in the requested order", async () => {
  const [pageTwo] = await runPlan(buildSplitCommand(2), [simple]);
  const [pageOne] = await runPlan(buildSplitCommand(1), [simple]);
  const [reordered] = await runThree(buildCommand("merge", 2, {}), [pageTwo.bytes, pageOne.bytes]);
  const [text] = await runPlan(buildCommand("pdf-to-text", 1, {}), [reordered.bytes]);
  const content = new TextDecoder().decode(text.bytes);
  assert.ok(content.indexOf("page 2") < content.indexOf("page 1"));
});

test("page selection operations are deterministic through split and merge", async () => {
  async function composite(pages) {
    const selected = [];
    for (const page of pages) {
      const [output] = await runPlan(buildSplitCommand(page), [simple]);
      selected.push(output.bytes);
    }
    if (selected.length === 1) return [{ name: "output.pdf", bytes: selected[0] }];
    return runPlan(buildCommand("merge", selected.length, {}), selected);
  }

  for (const pages of [[2], [1], [2, 1], [1, 2, 1]]) {
    const first = await composite(pages);
    const second = await composite(pages);
    const third = await composite(pages);
    assert.deepEqual(hashes(first), hashes(second));
    assert.deepEqual(hashes(second), hashes(third));
    assert.equal(await pageCount(first[0].bytes), pages.length);
  }
});
