import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("password protection is AES-256-only, local and explicit about its limits", () => {
  const wrapper = read("app/lib/pdf-encrypt.ts");
  const component = read("app/components/protect-tool-app.tsx");
  const catalog = read("app/lib/catalog.ts");
  assert.match(wrapper, /algorithm: "AES-256"/);
  assert.match(wrapper, /isSecureContext/);
  assert.match(wrapper, /crypto\??\.subtle/);
  assert.doesNotMatch(component, /algorithm.*RC4/);
  assert.match(component, /permissions are advisory/);
  assert.match(component, /Encryption is not redaction/);
  assert.match(component, /Download protected PDF/);
  assert.match(catalog, /slug: "protect-pdf"/);
  assert.match(catalog, /special: "protect"/);
  assert.equal(existsSync(new URL("../app/lib/vendor/pdf-encrypt/LICENSE", import.meta.url)), true);
  assert.equal(JSON.parse(read("app/lib/vendor/pdf-encrypt/package.json")).version, "1.2.0");
  assert.match(read("THIRD_PARTY_NOTICES.md"), /@pdfsmaller\/pdf-encrypt` 1\.2\.0/);
  assert.equal(existsSync(new URL("../public/legal/PDF-ENCRYPT-MIT.txt", import.meta.url)), true);
});
