import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { encryptPDF } from "../app/lib/vendor/pdf-encrypt/index.mjs";

async function formHeavyPdf() {
  const document = await PDFDocument.create();
  document.setTitle("Metadata (parentheses) \\ marker");
  document.setAuthor("SnackPDF encryption fixture");
  document.setSubject("Form-heavy interoperability test");
  const page = document.addPage([612, 792]);
  const font = await document.embedFont(StandardFonts.Helvetica);
  page.drawText("Body (parentheses) and backslash \\ marker", { x: 50, y: 700, size: 12, font, color: rgb(0, 0, 0) });
  const form = document.getForm();
  const text = form.createTextField("person.name");
  text.setText("Ada (test) \\ value");
  text.addToPage(page, { x: 50, y: 650, width: 300, height: 20, font });
  const checkbox = form.createCheckBox("consent");
  checkbox.check();
  checkbox.addToPage(page, { x: 50, y: 610, width: 16, height: 16 });
  form.updateFieldAppearances(font);
  return document.save();
}

async function decryptWithPdfJs(bytes, password) {
  const document = await getDocument({
    data: new Uint8Array(bytes),
    password,
    standardFontDataUrl: "./node_modules/pdfjs-dist/standard_fonts/",
  }).promise;
  const fields = await document.getFieldObjects();
  const page = await document.getPage(1);
  const text = (await page.getTextContent()).items.map((item) => item.str).join("|");
  const metadata = await document.getMetadata();
  return { fields, text, metadata };
}

test("AES-256 encryption round-trips a form-heavy PDF five times", async () => {
  const input = await formHeavyPdf();
  const encrypted = [];
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const output = await encryptPDF(new Uint8Array(input), "open-password", {
      ownerPassword: "owner-password",
      algorithm: "AES-256",
      allowPrinting: true,
      allowModifying: false,
      allowCopying: false,
      allowAnnotating: false,
      allowFillingForms: true,
      allowExtraction: true,
      allowAssembly: false,
      allowHighQualityPrint: false,
    });
    const source = Buffer.from(output).toString("latin1");
    assert.match(source, /\/V\s+5/);
    assert.match(source, /\/R\s+6/);
    assert.match(source, /\/CFM\s+\/AESV3/);
    encrypted.push(output);
  }

  assert.equal(new Set(encrypted.map((bytes) => Buffer.from(bytes).toString("base64"))).size, 5, "AES output must use fresh random salts and file keys");
  const results = await Promise.all(encrypted.map((bytes) => decryptWithPdfJs(bytes, "open-password")));
  const comparable = results.map(({ fields, text, metadata }) => ({
    fields: [...fields.entries()].map(([name, entries]) => [name, entries.map(({ name: fieldName, value, type }) => ({ name: fieldName, value, type }))]),
    text,
    title: metadata.info.Title,
    author: metadata.info.Author,
  }));
  assert.deepEqual(comparable.slice(1), comparable.slice(0, -1));
  assert.match(comparable[0].text, /Body \(parentheses\) and backslash \\ marker/);
  assert.equal(comparable[0].title, "Metadata (parentheses) \\ marker");
  assert.equal(comparable[0].fields.find(([name]) => name === "person.name")[1][1].value, "Ada (test) \\ value");
});

test("wrong AES-256 password fails instead of returning a blank document", async () => {
  const input = await formHeavyPdf();
  const encrypted = await encryptPDF(new Uint8Array(input), "open-password", { ownerPassword: "owner-password", algorithm: "AES-256" });
  await assert.rejects(
    () => decryptWithPdfJs(encrypted, "wrong-password"),
    (error) => error?.name === "PasswordException" || /password/i.test(String(error?.message)),
  );
});
