import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the footer has one honest, followable Dialegein attribution", () => {
  const source = readFileSync(new URL("../app/components/site-frame.tsx", import.meta.url), "utf8");
  assert.match(source, /SnackPDF is listed by/);
  assert.match(source, /href="https:\/\/dialegein\.com"/);
  assert.doesNotMatch(source, /rel="[^"]*nofollow/);
});
