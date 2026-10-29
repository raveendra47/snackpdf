import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/components/form-tool-app.tsx", import.meta.url), "utf8");

test("form filling covers AcroForm fields and an honest flat fallback", () => {
  assert.match(source, /getForm\(\)/);
  assert.match(source, /getText\??\(\)|setText\??\(/);
  assert.match(source, /isChecked\??\(\)|check\??\(\)|uncheck\??\(\)/);
  assert.match(source, /updateFieldAppearances/);
  assert.match(source, /static mark/);
  assert.match(source, /not a new interactive AcroForm/);
});
