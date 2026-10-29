import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import loadGhostscript from "@okathira/ghostpdl-wasm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const ROUTES = [
  ["/", "What do you need to do?"],
  ["/compress-pdf", "Compress PDF"], ["/rebuild-pdf", "Rebuild PDF"],
  ["/grayscale-pdf", "Grayscale PDF"], ["/merge-pdf", "Merge PDF files"],
  ["/split-pdf", "Split PDF into individual pages"], ["/extract-pages", "Extract pages from PDF"],
  ["/remove-pages", "Remove pages from PDF"], ["/reorder-pages", "Reorder PDF pages"],
  ["/pdf-to-jpg", "PDF to JPG"], ["/pdf-to-png", "PDF to PNG"],
  ["/pdf-to-text", "Extract text from PDF"], ["/ocr-pdf", "Extract text from scanned PDF"],
  ["/redact-pdf", "Redact PDF content"], ["/fill-pdf-form", "Fill PDF form"], ["/protect-pdf", "Protect PDF with a password"], ["/unlock-pdf", "Unlock PDF"],
  ["/about", "About"],
  ["/privacy", "Privacy"], ["/terms", "Terms"], ["/cookies", "Cookies"],
  ["/open-source-licences", "Source and licences"], ["/offline-use", "Offline use"],
  ["/how-snackpdf-is-tested", "How SnackPDF is tested"],
  ["/support", "Support SnackPDF"],
  ["/guides/compress-pdf-without-uploading", "How to compress a PDF without uploading it"],
  ["/guides/verify-local-pdf-processing", "How to verify that a PDF tool processes files locally"],
  ["/guides/use-pdf-tools-offline", "How to use PDF tools offline without Wi-Fi"],
];

const FILE_MARKER = "SNACKPDF_FILENAME_MARKER_7F3A";
const TEXT_MARKER = "SNACKPDF_TEXT_MARKER_7F3A";
const METADATA_MARKER = "SNACKPDF_METADATA_MARKER_7F3A";
const PASSWORD_MARKER = "SNACKPDF_PASSWORD_MARKER_7F3A";
const OWNER_PASSWORD = "SNACKPDF_OWNER_MARKER_7F3A";

let fixturePdf;
let encryptedPdf;
let fixtureHash;
let formHeavyFixture;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const wasmBinary = new Uint8Array(await readFile(new URL("../../node_modules/@okathira/ghostpdl-wasm/dist/gs.wasm", import.meta.url)));
  const postScript = new Uint8Array(await readFile(new URL("../fixtures/fidelity.ps", import.meta.url)));

  const run = async (args, inputs, outputName) => {
    const logs = [];
    const engine = await loadGhostscript({
      wasmBinary,
      noExitRuntime: true,
      print: (line) => logs.push(String(line)),
      printErr: (line) => logs.push(String(line)),
    });
    for (const [name, bytes] of Object.entries(inputs)) engine.FS.writeFile(name, bytes);
    const status = engine.callMain(args);
    expect(status, logs.join("\n")).toBe(0);
    return new Uint8Array(engine.FS.readFile(outputName, { encoding: "binary" })).slice();
  };

  fixturePdf = await run([
    "-dSAFER", "-dBATCH", "-dNOPAUSE", "-dNOPROMPT", "-sDEVICE=pdfwrite",
    "-dCompatibilityLevel=1.4", "-dOmitInfoDate=true", "-dOmitID=true", "-dOmitXMP=true",
    "-dCompressPages=false", "-dUseFlateCompression=false",
    "--permit-file-read=fixture.ps", "--permit-file-write=fixture.pdf",
    "-sOutputFile=fixture.pdf", "fixture.ps",
  ], { "fixture.ps": postScript }, "fixture.pdf");

  encryptedPdf = await run([
    "-dSAFER", "-dBATCH", "-dNOPAUSE", "-dNOPROMPT", "-sDEVICE=pdfwrite",
    "-dCompatibilityLevel=1.7", "-dOmitInfoDate=true", "-dOmitID=true", "-dOmitXMP=true",
    `-sUserPassword=${PASSWORD_MARKER}`, `-sOwnerPassword=${OWNER_PASSWORD}`,
    "-dEncryptionR=3", "-dKeyLength=128", "-dPermissions=-4",
    "--permit-file-read=fixture.pdf", "--permit-file-write=encrypted.pdf",
    "-sOutputFile=encrypted.pdf", "fixture.pdf",
  ], { "fixture.pdf": fixturePdf }, "encrypted.pdf");

  const fixtureText = Buffer.from(fixturePdf).toString("latin1");
  expect(fixtureText).toContain(TEXT_MARKER);
  expect(fixtureText).toContain(METADATA_MARKER);
  fixtureHash = createHash("sha256").update(fixturePdf).digest("hex");

  const formDocument = await PDFDocument.create();
  formDocument.setTitle("Metadata (parentheses) \\ marker");
  formDocument.setAuthor("SnackPDF encryption fixture");
  formDocument.setSubject("Form-heavy interoperability test");
  const formPage = formDocument.addPage([612, 792]);
  const formFont = await formDocument.embedFont(StandardFonts.Helvetica);
  formPage.drawText("Body (parentheses) and backslash \\ marker", { x: 50, y: 700, size: 12, font: formFont, color: rgb(0, 0, 0) });
  const form = formDocument.getForm();
  const textField = form.createTextField("person.name");
  textField.setText("Ada (test) \\ value");
  textField.addToPage(formPage, { x: 50, y: 650, width: 300, height: 20, font: formFont });
  const checkBox = form.createCheckBox("consent");
  checkBox.check();
  checkBox.addToPage(formPage, { x: 50, y: 610, width: 16, height: 16 });
  form.updateFieldAppearances(formFont);
  formHeavyFixture = new Uint8Array(await formDocument.save());
});

test("every shipped route has a predictable, keyboard-visible structure", async ({ browserName, page }) => {
  for (const [route, heading] of ROUTES) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page.getByRole("link", { name: "Skip to main content" })).toHaveAttribute("href", "#main-content");
    expect(await page.locator("h1").count(), route).toBe(1);
    if (route.endsWith("-pdf") || route.startsWith("/pdf-to-") || ["/extract-pages", "/remove-pages", "/reorder-pages"].includes(route)) {
      await expect(page.locator(".at-a-glance")).toContainText("Input:");
      await expect(page.locator(".at-a-glance")).toContainText("Output:");
      await expect(page.locator(".at-a-glance")).toContainText("Original");
    }
  }

  await page.goto("/");
  await expect(page.getByRole("link", { name: /Support SnackPDF/ })).toHaveCount(1);

  await page.goto("/compress-pdf");
  // Safari/WebKit uses Option-Tab for links unless Full Keyboard Access is enabled.
  await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
  const focus = await page.evaluate(() => {
    const element = document.activeElement;
    const style = element ? getComputedStyle(element) : null;
    return { text: element?.textContent?.trim(), outlineWidth: style?.outlineWidth, outlineStyle: style?.outlineStyle };
  });
  expect(focus.text).toBe("Skip to main content");
  expect(focus.outlineStyle).not.toBe("none");
  expect(Number.parseFloat(focus.outlineWidth ?? "0")).toBeGreaterThanOrEqual(2);

  await page.locator("#pdf-file").setInputFiles({ name: "style-check.pdf", mimeType: "application/pdf", buffer: Buffer.from(fixturePdf) });
  const primary = page.getByRole("button", { name: "Compress PDF", exact: true });
  await expect(primary).toBeEnabled();
  const primaryStyle = await primary.evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, color: style.color, borderWidth: style.borderWidth };
  });
  expect(primaryStyle.background).toBe("rgb(197, 59, 57)");
  expect(primaryStyle.color).toBe("rgb(255, 255, 255)");
  expect(Number.parseFloat(primaryStyle.borderWidth)).toBeGreaterThanOrEqual(1);
  await page.getByRole("button", { name: "Remove style-check.pdf" }).click();

  const largePdf = Buffer.concat([Buffer.from(fixturePdf), Buffer.alloc(20 * 1024 * 1024)]);
  await page.locator("#pdf-file").setInputFiles({ name: `${FILE_MARKER}-cancel.pdf`, mimeType: "application/pdf", buffer: largePdf });
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("alert")).toContainText("operation was cancelled");
  await page.waitForTimeout(700);
  await expect(page.getByRole("heading", { name: "Done" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Selected file/ })).toHaveCount(0);
});

test("representative routes remain compact at wide, narrow, tablet and phone widths", async ({ page }) => {
  const routes = ["/", "/about", "/compress-pdf", "/merge-pdf", "/reorder-pages", "/privacy", "/offline-use", "/guides/verify-local-pdf-processing"];
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: width <= 390 ? 844 : 900 });
    for (const route of routes) {
      await page.goto(route);
      const layout = await page.evaluate(() => ({
        viewport: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyFontSize: Number.parseFloat(getComputedStyle(document.body).fontSize),
      }));
      expect(layout.documentWidth, `${route} at ${width}px`).toBeLessThanOrEqual(layout.viewport);
      expect(layout.bodyFontSize, `${route} at ${width}px`).toBeGreaterThanOrEqual(16);
      await expect(page.locator("h1")).toBeVisible();
    }
  }
});

test("the homepage explains privacy and offline setup", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Your PDFs stay on this device.")).toBeVisible();
  await expect(page.locator(".site-notice").getByText(/Checking offline setup|Preparing offline use|Ready to work offline|You are offline\. Ready to work offline/)).toBeVisible();
  await expect(page.getByText("Processed locally")).toBeVisible();
  await expect(page.getByText("Available offline")).toBeVisible();
  await expect(page.getByRole("link", { name: /Support SnackPDF/ })).toBeVisible();
});

test("password protection produces a downloadable AES-256 file and wrong password fails cleanly", async ({ context, page }) => {
  const requests = [];
  context.on("request", (request) => requests.push({ url: request.url(), method: request.method(), body: request.postDataBuffer()?.toString("base64") ?? "" }));
  await page.goto("/protect-pdf");
  await page.locator("#protect-pdf-file").setInputFiles({ name: "form-heavy.pdf", mimeType: "application/pdf", buffer: Buffer.from(formHeavyFixture) });
  await page.locator("#protect-user-password").fill("open-password");
  await page.locator("#protect-owner-password").fill("owner-password");
  await page.getByLabel("Copying text and images").uncheck();
  await page.getByRole("button", { name: "Protect PDF", exact: true }).click();
  await expect(page.getByRole("heading", { name: "PDF protected" })).toBeVisible({ timeout: 120_000 });
  const link = page.getByRole("link", { name: "Download protected PDF" });
  await expect(link).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const encrypted = await readFile(downloadPath);
  expect(encrypted.toString("latin1")).toMatch(/\/V\s+5/);
  expect(encrypted.toString("latin1")).toMatch(/\/R\s+6/);
  expect(encrypted.toString("latin1")).toMatch(/\/CFM\s+\/AESV3/);
  expect(encrypted.toString("latin1")).not.toContain("Body (parentheses)");

  await page.goto("/unlock-pdf");
  await page.locator("#pdf-file").setInputFiles({ name: "form-heavy-protected.pdf", mimeType: "application/pdf", buffer: encrypted });
  await expect(page.getByRole("heading", { name: /Selected file/ })).toBeVisible({ timeout: 120_000 });
  await page.getByLabel("PDF password").fill("wrong-password");
  await page.getByRole("button", { name: "Unlock PDF", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(/password|open|process/i, { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "Done" })).toHaveCount(0);
  const httpRequests = requests.filter(({ url }) => /^https?:/.test(url));
  expect(httpRequests.filter(({ url }) => !url.startsWith("http://127.0.0.1:4173/")).length).toBe(0);
  expect(httpRequests.every(({ body }) => body === "")).toBe(true);
});

test("the 100-request locality regression stays same-origin", async ({ context, page }) => {
  const requests = [];
  context.on("request", (request) => requests.push(request.url()));
  await page.goto("/");
  await page.evaluate(async () => {
    await Promise.all(Array.from({ length: 100 }, () => fetch("/?locality-regression=1", { cache: "no-store" })));
  });
  expect(requests.length).toBeGreaterThanOrEqual(100);
  expect(requests.filter((url) => !url.startsWith("http://127.0.0.1:4173/")).length).toBe(0);
});

test("all advertised transformations finish locally with deterministic names and private markers", async ({ context, page, browserName }) => {
  const browserRequests = [];
  context.on("request", (request) => {
    browserRequests.push({
      url: request.url(),
      headers: request.headers(),
      body: request.postDataBuffer()?.toString("base64") ?? "",
    });
  });

  await context.addInitScript(() => {
    const audit = { events: [], console: [], blobs: { created: [], revoked: [] } };
    Object.defineProperty(window, "__SNACKPDF_PRIVACY_AUDIT", { value: audit, configurable: false });
    const record = (type, value) => audit.events.push({ type, value: String(value ?? "") });
    const createObjectURL = URL.createObjectURL.bind(URL);
    const revokeObjectURL = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (value) => {
      const url = createObjectURL(value);
      audit.blobs.created.push(url);
      return url;
    };
    URL.revokeObjectURL = (url) => {
      audit.blobs.revoked.push(String(url));
      return revokeObjectURL(url);
    };
    const describeBody = (body) => {
      if (body == null) return "";
      if (typeof body === "string") return body;
      if (body instanceof URLSearchParams) return body.toString();
      if (body instanceof ArrayBuffer) return Array.from(new Uint8Array(body).slice(0, 512)).join(",");
      if (ArrayBuffer.isView(body)) return Array.from(new Uint8Array(body.buffer, body.byteOffset, Math.min(body.byteLength, 512))).join(",");
      return Object.prototype.toString.call(body);
    };

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const request = new Request(input, init);
      let body = "";
      if (request.method !== "GET" && request.method !== "HEAD") {
        try { body = Array.from(new Uint8Array(await request.clone().arrayBuffer()).slice(0, 512)).join(","); } catch { body = "unreadable"; }
      }
      record("fetch", `${request.method} ${request.url} ${body}`);
      return originalFetch(input, init);
    };

    const xhrOpen = XMLHttpRequest.prototype.open;
    const xhrSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      this.__snackpdfAuditUrl = String(url);
      return xhrOpen.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.send = function(body) {
      record("xhr", `${this.__snackpdfAuditUrl ?? ""} ${describeBody(body)}`);
      return xhrSend.call(this, body);
    };

    const OriginalWebSocket = window.WebSocket;
    window.WebSocket = class extends OriginalWebSocket {
      constructor(url, protocols) {
        record("websocket", url);
        super(url, protocols);
      }
    };
    const OriginalEventSource = window.EventSource;
    window.EventSource = class extends OriginalEventSource {
      constructor(url, options) {
        record("eventsource", url);
        super(url, options);
      }
    };
    const originalBeacon = navigator.sendBeacon?.bind(navigator);
    if (originalBeacon) navigator.sendBeacon = (url, data) => {
      record("beacon", `${url} ${describeBody(data)}`);
      return originalBeacon(url, data);
    };

    const formSubmit = HTMLFormElement.prototype.submit;
    HTMLFormElement.prototype.submit = function() {
      record("form", `${this.method} ${this.action}`);
      return formSubmit.call(this);
    };
    window.addEventListener("submit", (event) => {
      const form = event.target;
      if (form instanceof HTMLFormElement) record("form-event", `${form.method} ${form.action}`);
    }, true);

    for (const method of ["pushState", "replaceState"]) {
      const original = history[method].bind(history);
      history[method] = (state, unused, url) => {
        record(`history-${method}`, `${url ?? ""} ${JSON.stringify(state)}`);
        return original(state, unused, url);
      };
    }
    for (const method of ["log", "info", "warn", "error", "debug"]) {
      const original = console[method].bind(console);
      console[method] = (...values) => {
        audit.console.push(values.map((value) => String(value)).join(" "));
        original(...values);
      };
    }
  });

  const payload = (suffix = "") => ({
    name: `${FILE_MARKER}${suffix}.pdf`,
    mimeType: "application/pdf",
    buffer: Buffer.from(fixturePdf),
  });
  const auditSnapshots = [];

  const finish = async ({ route, action, files = [payload()], prepare, outputCount = 1, magic = "%PDF-", contains = "" }) => {
    await page.goto(route);
    await expect(page.locator("#pdf-file")).toBeEnabled();
    await page.locator("#pdf-file").setInputFiles(files);
    await expect(page.getByRole("heading", { name: /Selected file/ })).toBeVisible({ timeout: 120_000 });
    if (prepare) await prepare();
    await page.getByRole("button", { name: action, exact: true }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Done" })).toBeVisible({ timeout: 120_000 });
    await expect(page.getByRole("link", { name: /^Download / })).toHaveCount(outputCount);
    await expect(page.locator(".result-summary")).toContainText("Action:");
    await expect(page.locator(".result-summary")).toContainText("Output:");
    await expect(page.locator(".result-file-details").first()).toContainText("Filename:");
    await expect(page.locator(".result-file-details").first()).toContainText("Type:");
    await expect(page.locator(".result-file-details").first()).toContainText("Size:");
    if (route === "/compress-pdf") {
      for (const label of ["Original size:", "Result size:", "Bytes saved:", "Percentage saved:"]) {
        await expect(page.locator(".result-summary")).toContainText(label);
      }
    }
    const link = page.getByRole("link", { name: /^Download / }).first();
    const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const bytes = await readFile(downloadPath);
    expect(bytes.length).toBeGreaterThan(0);
    if (magic) expect(bytes.subarray(0, magic.length).toString("latin1")).toBe(magic);
    if (contains) expect(bytes.toString("utf8")).toContain(contains);
    await page.getByRole("button", { name: "Start again" }).click();
    const audit = await page.evaluate(() => window.__SNACKPDF_PRIVACY_AUDIT);
    expect(new Set(audit.blobs.revoked)).toEqual(new Set(audit.blobs.created));
    auditSnapshots.push(audit);
  };

  await finish({ route: "/compress-pdf", action: "Compress PDF" });
  await finish({ route: "/rebuild-pdf", action: "Rebuild PDF" });
  await finish({ route: "/grayscale-pdf", action: "Make grayscale PDF" });
  await finish({
    route: "/merge-pdf", action: "Merge PDFs", files: [payload("-A"), payload("-B")],
    prepare: async () => {
      const secondName = `${FILE_MARKER}-B.pdf`;
      await page.getByRole("button", { name: `Move ${secondName} up` }).click();
      await expect(page.getByText(new RegExp(`${secondName} moved to position 1`))).toBeAttached();
    },
  });
  await finish({ route: "/split-pdf", action: "Split PDF", outputCount: 3 });
  await finish({
    route: "/extract-pages", action: "Extract pages",
    prepare: async () => {
      await page.getByLabel("Pages").fill("2,1,3");
      await expect(page.getByText("Interpreted sequence: 2, 1, 3")).toBeVisible();
    },
  });
  await finish({
    route: "/remove-pages", action: "Remove selected pages",
    prepare: async () => page.getByRole("button", { name: "Page 1: remove this page" }).click(),
  });
  await finish({
    route: "/reorder-pages", action: "Create reordered PDF",
    prepare: async () => {
      const move = page.getByRole("button", { name: "Move page 1 right" });
      await move.focus();
      await move.press("Enter");
      await expect(page.getByText("Page 1 moved to position 2 of 3.")).toBeAttached();
      expect(await move.evaluate((element) => document.activeElement === element)).toBe(true);
    },
  });
  await finish({
    route: "/pdf-to-jpg", action: "Convert to JPG", outputCount: 3, magic: "ÿØÿ",
    prepare: async () => page.getByLabel(/Screen — 96 DPI/).check(),
  });
  await finish({
    route: "/pdf-to-png", action: "Convert to PNG", outputCount: 3, magic: "\u0089PNG",
    prepare: async () => page.getByLabel(/Screen — 96 DPI/).check(),
  });
  await finish({ route: "/pdf-to-text", action: "Extract text", magic: "", contains: TEXT_MARKER });
  await finish({
    route: "/unlock-pdf", action: "Unlock PDF",
    files: [{ name: `${FILE_MARKER}-encrypted.pdf`, mimeType: "application/pdf", buffer: Buffer.from(encryptedPdf) }],
    prepare: async () => page.getByLabel("PDF password").fill(PASSWORD_MARKER),
  });

  const auditText = JSON.stringify({ browserRequests, auditSnapshots });
  for (const marker of [FILE_MARKER, TEXT_MARKER, METADATA_MARKER, PASSWORD_MARKER, OWNER_PASSWORD, fixtureHash]) {
    expect(auditText, `${browserName} leaked ${marker}`).not.toContain(marker);
  }
  const httpRequests = browserRequests.filter((request) => /^https?:/.test(request.url));
  for (const request of httpRequests) expect(request.url.startsWith("http://127.0.0.1:4173/"), request.url).toBe(true);
  for (const request of httpRequests) expect(request.body).toBe("");

  expect(await context.cookies()).toEqual([]);
  const storageAudit = await page.evaluate(async ({ markers, byteMarker }) => {
    const local = Object.keys(localStorage).flatMap((key) => [key, localStorage.getItem(key) ?? ""]);
    const databases = indexedDB.databases ? await indexedDB.databases() : [];
    const cacheFindings = [];
    const needle = Uint8Array.from(atob(byteMarker), (character) => character.charCodeAt(0));
    const containsBytes = (haystack, wanted) => {
      outer: for (let index = 0; index <= haystack.length - wanted.length; index += 1) {
        for (let offset = 0; offset < wanted.length; offset += 1) if (haystack[index + offset] !== wanted[offset]) continue outer;
        return true;
      }
      return false;
    };
    for (const cacheName of await caches.keys()) {
      const cache = await caches.open(cacheName);
      for (const request of await cache.keys()) {
        const response = await cache.match(request);
        const bytes = response ? new Uint8Array(await response.clone().arrayBuffer()) : new Uint8Array();
        const text = new TextDecoder().decode(bytes);
        if (markers.some((marker) => request.url.includes(marker) || text.includes(marker)) || containsBytes(bytes, needle)) {
          cacheFindings.push(request.url);
        }
      }
    }
    return { local, databases, cacheFindings, location: location.href };
  }, {
    markers: [FILE_MARKER, TEXT_MARKER, METADATA_MARKER, PASSWORD_MARKER, OWNER_PASSWORD, fixtureHash],
    byteMarker: Buffer.from(fixturePdf.slice(0, 256)).toString("base64"),
  });
  expect(storageAudit.local).toEqual([]);
  expect(storageAudit.databases).toEqual([]);
  expect(storageAudit.cacheFindings).toEqual([]);
  for (const marker of [FILE_MARKER, TEXT_MARKER, METADATA_MARKER, PASSWORD_MARKER, fixtureHash]) {
    expect(storageAudit.location).not.toContain(marker);
  }
});

test("the complete application reopens and processes a fixture offline", async ({ browserName, context, page }) => {
  await page.goto("/");
  await expect(page.getByText("Ready to work offline.")).toBeVisible({ timeout: 90_000 });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  if (browserName === "webkit") {
    const missingCacheEntries = await page.evaluate(async (routes) => {
      const cacheNames = await caches.keys();
      const releaseCaches = await Promise.all(cacheNames.map((name) => caches.open(name)));
      const missing = [];
      for (const route of routes) {
        const requestUrl = new URL(route, location.href).href;
        const matches = await Promise.all(releaseCaches.map((cache) => cache.match(requestUrl)));
        if (!matches.some(Boolean)) missing.push(route);
      }
      return missing;
    }, ROUTES.map(([route]) => route));
    expect(missingCacheEntries).toEqual([]);
    // Playwright's WebKit offline emulation cannot reliably start a service-worker
    // navigation or initialise a nested Worker. Load the cached tool and initialise
    // its engine first, then prove the job finishes with the network disabled;
    // Chromium and Firefox exercise every cold offline navigation below.
    await page.goto("/compress-pdf");
    await page.locator("#pdf-file").setInputFiles({ name: "offline-fixture.pdf", mimeType: "application/pdf", buffer: Buffer.from(fixturePdf) });
    await expect(page.getByRole("button", { name: "Compress PDF", exact: true })).toBeEnabled({ timeout: 120_000 });
  }

  const blockNetworkRequest = (route) => route.abort();
  if (browserName === "webkit") {
    // Playwright's WebKit `setOffline` currently stalls nested Workers. Routing
    // all network fall-throughs to failure preserves the outage assertion while
    // allowing service-worker cache hits and the already-running Worker to operate.
    await context.route("**/*", blockNetworkRequest);
  } else {
    await context.setOffline(true);
  }
  try {
    if (browserName !== "webkit") {
      for (const [route, heading] of ROUTES) {
        await page.goto(route, { waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      }
      await page.goto("/compress-pdf");
      await page.locator("#pdf-file").setInputFiles({ name: "offline-fixture.pdf", mimeType: "application/pdf", buffer: Buffer.from(fixturePdf) });
    }
    await expect(page.getByRole("heading", { name: "Selected file", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Compress PDF", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Compress PDF", exact: true }).press("Enter");
    await expect(page.getByRole("heading", { level: 2, name: "Done" })).toBeVisible({ timeout: 120_000 });
    await expect(page.getByRole("link", { name: "Download offline-fixture-compressed.pdf" })).toBeVisible();
  } finally {
    if (browserName === "webkit") {
      await context.unroute("**/*", blockNetworkRequest);
    } else {
      await context.setOffline(false);
    }
  }
});

test("keyboard placement supports redaction and removing a mistaken flat-form annotation", async ({ page, browserName }) => {
  await page.goto("/redact-pdf");
  await page.locator("#redact-pdf-file").setInputFiles({ name: "keyboard.pdf", mimeType: "application/pdf", buffer: Buffer.from(fixturePdf) });
  const addBox = page.getByRole("button", { name: "Add redaction box to page 1", exact: true });
  await expect(addBox).toBeEnabled();
  await addBox.press("Enter");
  await expect(page.getByRole("button", { name: "Remove box 1 from page 1" })).toBeVisible();
  if (process.env.SNACKPDF_REVIEW_OUTPUT_DIR && browserName === "chromium") await page.locator(".redaction-page").first().screenshot({ path: `${process.env.SNACKPDF_REVIEW_OUTPUT_DIR}/redaction-keyboard-controls.png` });
  await page.getByRole("button", { name: "Apply redactions", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Redaction complete" })).toBeVisible();
  const [redactionDownload] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download redacted PDF" }).click()]);
  const redacted = await PDFDocument.load(await readFile(await redactionDownload.path()));
  expect(redacted.getPageCount()).toBe(3);
  await addBox.press("Enter");
  await expect(page.getByRole("link", { name: "Download redacted PDF" })).toHaveCount(0);

  await page.goto("/fill-pdf-form");
  await page.locator("#fill-pdf-file").setInputFiles({ name: "flat.pdf", mimeType: "application/pdf", buffer: Buffer.from(fixturePdf) });
  await page.getByRole("textbox", { name: "Annotation text" }).fill("Ada Lovelace");
  const addAnnotation = page.getByRole("button", { name: "Add annotation to page 1", exact: true });
  await addAnnotation.press("Enter");
  await page.getByRole("button", { name: "Remove annotation 1 from page 1" }).press("Enter");
  await expect(page.getByRole("button", { name: "Save filled PDF", exact: true })).toBeDisabled();
  await addAnnotation.press("Enter");
  await page.getByRole("button", { name: "Save filled PDF", exact: true }).click();
  await expect(page.getByRole("heading", { name: "PDF saved" })).toBeVisible();
  const [formDownload] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download filled PDF" }).click()]);
  const filled = await PDFDocument.load(await readFile(await formDownload.path()));
  expect(filled.getPageCount()).toBe(3);
  await page.getByRole("button", { name: "Remove annotation 1 from page 1" }).press("Enter");
  await expect(page.getByRole("link", { name: "Download filled PDF" })).toHaveCount(0);
});

test("field edits and clearing a choice are reflected in the saved PDF", async ({ page }) => {
  const doc = await PDFDocument.create();
  const sheet = doc.addPage();
  const form = doc.getForm();
  const name = form.createTextField("Name");
  name.setText("Original");
  name.addToPage(sheet, { x: 20, y: 400, width: 200, height: 20 });
  const choice = form.createDropdown("Choice");
  choice.addOptions(["First", "Second"]);
  choice.select("First");
  choice.addToPage(sheet, { x: 20, y: 350, width: 200, height: 20 });
  await page.goto("/fill-pdf-form");
  await page.locator("#fill-pdf-file").setInputFiles({ name: "fields.pdf", mimeType: "application/pdf", buffer: Buffer.from(await doc.save()) });
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Zoë García");
  await page.getByRole("combobox", { name: "Choice", exact: true }).selectOption("");
  await page.getByRole("button", { name: "Save filled PDF", exact: true }).click();
  await expect(page.getByRole("heading", { name: "PDF saved" })).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download filled PDF" }).click()]);
  const result = await PDFDocument.load(await readFile(await download.path()));
  expect(result.getForm().getTextField("Name").getText()).toBe("Zoë García");
  expect(result.getForm().getDropdown("Choice").getSelected()).toEqual([]);
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("山田");
  await expect(page.getByRole("link", { name: "Download filled PDF" })).toHaveCount(0);
  await page.getByRole("button", { name: "Save filled PDF", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("font cannot display");
  await expect(page.getByRole("textbox", { name: "Name", exact: true })).toHaveValue("山田");
});

test("page-selection errors preserve input and allow correction", async ({ page }) => {
  await page.goto("/extract-pages");
  await page.locator("#pdf-file").setInputFiles({ name: "ranges.pdf", mimeType: "application/pdf", buffer: Buffer.from(fixturePdf) });
  const pages = page.getByLabel("Pages", { exact: true });
  await pages.fill("99");
  await expect(pages).toHaveAttribute("aria-invalid", "true");
  await expect(pages).toHaveValue("99");
  await expect(page.getByRole("button", { name: "Extract pages", exact: true })).toBeDisabled();
  await pages.fill("2,1");
  await expect(page.getByRole("button", { name: "Extract pages", exact: true })).toBeEnabled();
  await expect(page.getByText("Interpreted sequence: 2, 1")).toBeVisible();
});

test("all initial routes pass the automated WCAG A/AA rules", async ({ page }) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  for (const [route] of ROUTES) {
    await page.goto(route);
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) })), route).toEqual([]);
  }
});

test("enlarged text and reduced motion retain readable task controls", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 800 });
  for (const route of ["/", "/compress-pdf", "/redact-pdf", "/fill-pdf-form", "/protect-pdf", "/offline-use"]) {
    await page.goto(route);
    // Reproducible text-only enlargement stress check, separate from browser zoom.
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    const result = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth, overflow: [...document.querySelectorAll("body *")].filter((element) => element.getBoundingClientRect().right > innerWidth + 1 || element.scrollWidth > element.clientWidth + 1).map((element) => ({tag: element.tagName, class: element.className, right: element.getBoundingClientRect().right, scroll:element.scrollWidth, client:element.clientWidth})), scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior }));
    expect(result.documentWidth, `${route}: ${JSON.stringify(result.overflow)}`).toBeLessThanOrEqual(result.width);
    expect(result.scrollBehavior).toBe("auto");
  }
});

test("special tools explain unreadable files and can recover with another file", async ({ page }) => {
  const malformed = await readFile(new URL("../fixtures/malformed.pdf", import.meta.url));
  for (const [route, input] of [["/redact-pdf", "#redact-pdf-file"], ["/fill-pdf-form", "#fill-pdf-file"], ["/ocr-pdf", "#ocr-pdf-file"]]) {
    await page.goto(route);
    await page.locator(input).setInputFiles({ name: "broken.pdf", mimeType: "application/pdf", buffer: malformed });
    if (route === "/ocr-pdf") await page.getByRole("button", { name: "Extract text from scan", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("could not be read");
    await page.locator(input).setInputFiles({ name: "valid.pdf", mimeType: "application/pdf", buffer: Buffer.from(fixturePdf) });
    await expect(page.getByRole("alert")).toHaveCount(0);
  }
});

test("OCR exposes honest empty results and a downloadable local text result", async ({ page }) => {
  const blank = await PDFDocument.create();
  blank.addPage([200, 200]);
  await page.goto("/ocr-pdf");
  await page.locator("#ocr-pdf-file").setInputFiles({ name: "blank.pdf", mimeType: "application/pdf", buffer: Buffer.from(await blank.save()) });
  await page.getByRole("button", { name: "Extract text from scan", exact: true }).click();
  await expect(page.getByText("No text was recognised.", { exact: false })).toBeVisible({ timeout: 120_000 });
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download .txt", exact: true }).click()]);
  expect((await readFile(await download.path(), "utf8")).trim()).toContain("Page 1");
});


test("online reload bypasses stale offline HTML", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Ready to work offline.", { exact: true })).toBeVisible({ timeout: 120_000 });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const names = await caches.keys();
    for (const name of names.filter(name => name.startsWith("snackpdf-"))) {
      const cache = await caches.open(name);
      await cache.put("/", new Response('<!doctype html><h1>STALE OFFLINE TEST COPY</h1>', { headers: { "Content-Type": "text/html" } }));
    }
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "What do you need to do?", exact: true })).toBeVisible();
});
