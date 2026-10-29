import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const ROUTES = [
  "/", "/compress-pdf", "/rebuild-pdf", "/grayscale-pdf", "/merge-pdf",
  "/split-pdf", "/extract-pages", "/remove-pages", "/reorder-pages",
  "/pdf-to-jpg", "/pdf-to-png", "/pdf-to-text", "/ocr-pdf", "/redact-pdf", "/fill-pdf-form", "/protect-pdf", "/unlock-pdf",
  "/about", "/privacy", "/terms", "/cookies", "/open-source-licences", "/offline-use",
  "/how-snackpdf-is-tested",
  "/support",
  "/guides/compress-pdf-without-uploading", "/guides/verify-local-pdf-processing",
  "/guides/use-pdf-tools-offline",
];

const fixture = await readFile(new URL("../fixtures/simple.pdf", import.meta.url));

test("narrow mobile layouts remain readable without horizontal overflow", async ({ page }) => {
  for (const route of ROUTES) {
    await page.goto(route);
    const layout = await page.evaluate(() => ({
      viewport: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyFontSize: Number.parseFloat(getComputedStyle(document.body).fontSize),
      headingCount: document.querySelectorAll("h1").length,
    }));
    expect(layout.documentWidth, route).toBeLessThanOrEqual(layout.viewport);
    expect(layout.bodyFontSize, route).toBeGreaterThanOrEqual(16);
    expect(layout.headingCount, route).toBe(1);
  }

  await page.goto("/compress-pdf");
  await page.locator("#pdf-file").setInputFiles({ name: "mobile-fixture.pdf", mimeType: "application/pdf", buffer: fixture });
  await expect(page.getByRole("heading", { name: "Selected file" })).toBeVisible();
  const undersizedTargets = await page.locator("button:visible, .file-label:visible").evaluateAll((elements) => elements.flatMap((element) => {
    const rectangle = element.getBoundingClientRect();
    return rectangle.width < 24 || rectangle.height < 24 ? [`${element.textContent?.trim()}:${rectangle.width}x${rectangle.height}`] : [];
  }));
  expect(undersizedTargets).toEqual([]);
});

test("the universal download fallback completes after an offline mobile workflow", async ({ browserName, context, page }) => {
  await page.goto("/");
  await expect(page.getByText("Ready to work offline.")).toBeVisible({ timeout: 90_000 });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.getByRole("link", { name: /^Compress PDF\./ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Compress PDF" })).toBeVisible();
  if (browserName === "webkit") {
    // Playwright WebKit cannot cold-start a nested Worker while its network
    // emulation is offline. Initialising it here still lets the test prove the
    // full operation and download fallback work after the network is disabled.
    await page.locator("#pdf-file").setInputFiles({ name: "mobile-offline.pdf", mimeType: "application/pdf", buffer: fixture });
    await expect(page.getByRole("button", { name: "Compress PDF", exact: true })).toBeEnabled({ timeout: 120_000 });
  }
  const blockNetworkRequest = (route) => route.abort();
  if (browserName === "webkit") {
    await context.route("**/*", blockNetworkRequest);
  } else {
    await context.setOffline(true);
  }
  try {
    if (browserName !== "webkit") {
      await page.locator("#pdf-file").setInputFiles({ name: "mobile-offline.pdf", mimeType: "application/pdf", buffer: fixture });
    }
    await page.getByRole("button", { name: "Compress PDF", exact: true }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Done" })).toBeVisible({ timeout: 120_000 });
    const link = page.getByRole("link", { name: "Download mobile-offline-compressed.pdf" });
    await expect(link).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
    expect(download.suggestedFilename()).toBe("mobile-offline-compressed.pdf");
  } finally {
    if (browserName === "webkit") {
      await context.unroute("**/*", blockNetworkRequest);
    } else {
      await context.setOffline(false);
    }
  }
});
