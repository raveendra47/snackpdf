import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/components/redaction-tool-app.tsx", import.meta.url), "utf8");

test("redaction is visibly irreversible and preserves unaffected pages", () => {
  assert.match(source, /lose searchable or selectable text/);
  assert.match(source, /copyPages\(source, \[index\]\)/);
  assert.match(source, /embedPng\(/);
  assert.match(source, /preview\?\.boxes\.length/);
  assert.match(source, /200 DPI/);
});
