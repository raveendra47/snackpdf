import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { ROUTES } from "../config/release-inventory.mjs";

const ORIGIN = "https://www.snackpdf.com";
const TOOL_ROUTES = ROUTES.slice(1, 17);
const HOME_TOOL_ROUTES = [
  "/compress-pdf", "/rebuild-pdf", "/grayscale-pdf",
  "/merge-pdf", "/split-pdf", "/extract-pages", "/remove-pages", "/reorder-pages", "/fill-pdf-form",
  "/pdf-to-jpg", "/pdf-to-png", "/pdf-to-text", "/ocr-pdf",
  "/redact-pdf", "/protect-pdf", "/unlock-pdf",
];

function routeFile(route) {
  return route === "/" ? "static-site/index.html" : `static-site${route}/index.html`;
}

function readRoute(route) {
  return readFileSync(new URL(`../${routeFile(route)}`, import.meta.url), "utf8");
}

function matches(html, pattern) {
  const globalPattern = pattern.global ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
  return [...html.matchAll(globalPattern)].map((match) => match[1]);
}

function one(html, pattern, label) {
  const values = matches(html, pattern);
  assert.equal(values.length, 1, `${label} must appear exactly once`);
  return values[0];
}

function plainText(fragment) {
  return fragment
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:amp|quot|#x27|#39|lt|gt);/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

test("indexable routes have unique, aligned search metadata", () => {
  const titles = new Set();
  const descriptions = new Set();

  for (const route of ROUTES) {
    const html = readRoute(route);
    const title = one(html, /<title>([^<]+)<\/title>/gi, `${route} title`);
    const description = one(html, /<meta name="description" content="([^"]+)"/gi, `${route} description`);
    const canonical = one(html, /<link rel="canonical" href="([^"]+)"/gi, `${route} canonical`);
    const ogUrl = one(html, /<meta property="og:url" content="([^"]+)"/gi, `${route} Open Graph URL`);
    const h1 = matches(html, /<h1(?:\s[^>]*)?>([\s\S]*?)<\/h1>/gi);

    assert.equal(h1.length, 1, `${route} must contain one H1`);
    assert.ok(plainText(h1[0]).length >= 5, `${route} H1 is not useful`);
    assert.ok(description.length >= 80 && description.length <= 180, `${route} description length is not useful`);
    assert.equal(canonical, `${ORIGIN}${route}`);
    assert.equal(ogUrl, canonical);
    assert.equal(titles.has(title), false, `Duplicate title: ${title}`);
    assert.equal(descriptions.has(description), false, `Duplicate description: ${description}`);
    titles.add(title);
    descriptions.add(description);

    if (route === "/") {
      assert.equal(matches(html, /<meta property="og:image" content="([^"]+)"/gi).length, 1);
    } else {
      assert.equal(matches(html, /<meta property="og:image" content="([^"]+)"/gi).length, 0, `${route} must not inherit the homepage image`);
      assert.equal(matches(html, /<meta name="twitter:image" content="([^"]+)"/gi).length, 0, `${route} must not inherit the homepage image`);
    }
  }
});

test("tool pages contain useful initial copy and restrained related links", () => {
  const markers = new Map([
    ["/compress-pdf", "A short or already well-compressed PDF"],
    ["/rebuild-pdf", "not a repair or recovery service"],
    ["/grayscale-pdf", "equal red, green and blue values"],
    ["/merge-pdf", "between two and 50 PDFs"],
    ["/split-pdf", "one output file for every page"],
    ["/extract-pages", "3,1,3 creates a three-page PDF"],
    ["/remove-pages", "not redaction"],
    ["/reorder-pages", "Every source page is retained exactly once"],
    ["/pdf-to-jpg", "JPEG is a rendered, lossy image"],
    ["/pdf-to-png", "lossless image encoding"],
    ["/pdf-to-text", "does not perform OCR"],
    ["/ocr-pdf", "English OCR data"],
    ["/redact-pdf", "lose searchable and selectable text"],
    ["/fill-pdf-form", "AcroForm"],
    ["/protect-pdf", "AES-256"],
    ["/unlock-pdf", "does not guess, crack, bypass or recover"],
  ]);

  for (const route of TOOL_ROUTES) {
    const html = readRoute(route);
    const main = one(html, /<main[^>]*>([\s\S]*?)<\/main>/gi, `${route} main`);
    const words = plainText(main).split(/\s+/).filter(Boolean);
    assert.ok(words.length >= 140, `${route} needs more operation-specific initial content`);
    assert.match(plainText(main).toLowerCase(), new RegExp(markers.get(route).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

    const related = one(main, /<section class="related-tools"[^>]*>([\s\S]*?)<\/section>/gi, `${route} related tools`);
    const relatedList = one(related, /<ul>([\s\S]*?)<\/ul>/gi, `${route} related tools list`);
    const links = matches(relatedList, /<a href="\/(.*?)"/gi).map((slug) => `/${slug}`);
    assert.ok(links.length >= 2 && links.length <= 4, `${route} must link to two to four related tools`);
    assert.equal(new Set(links).size, links.length, `${route} related tools contain a duplicate`);
    for (const link of links) assert.ok(TOOL_ROUTES.includes(link), `${route} links to unsupported tool ${link}`);
  }
});

test("priority tool pages answer practical privacy, price and compatibility questions", () => {
  for (const route of ["/compress-pdf", "/merge-pdf", "/split-pdf", "/pdf-to-jpg", "/grayscale-pdf", "/remove-pages", "/unlock-pdf"]) {
    const text = plainText(readRoute(route));
    for (const answer of ["Uploaded?", "Cost and account", "Watermark", "Offline", "Mobile", "Important limit"]) {
      assert.match(text, new RegExp(answer.replace(/[?]/g, "\\?"), "i"), `${route} is missing ${answer}`);
    }
    assert.match(text, /No account|without an account|No sign-in/i, `${route} account answer is unclear`);
    assert.match(text, /None is added/i, `${route} watermark answer is unclear`);
  }
});

test("guide pages are distinct, server-rendered and connected to evidence", () => {
  const guideRoutes = ROUTES.filter((route) => route.startsWith("/guides/"));
  assert.equal(guideRoutes.length, 3);
  for (const route of guideRoutes) {
    const html = readRoute(route);
    const text = plainText(html);
    assert.ok(text.split(/\s+/).length >= 250, `${route} is too thin`);
    assert.match(html, /href="\/privacy"|href="\/offline-use"/);
    assert.match(html, /href="\/how-snackpdf-is-tested"/);
    assert.doesNotMatch(html, /"@type":"FAQPage"/i);
    assert.doesNotMatch(html, /<script[^>]+src="https?:\/\//i);
  }
});

test("sitemap contains only prioritised canonical landing pages with meaningful dates", () => {
  const sitemap = readFileSync(new URL("../public/sitemap.xml", import.meta.url), "utf8");
  const locations = matches(sitemap, /<loc>([^<]+)<\/loc>/gi);
  const lastmods = matches(sitemap, /<lastmod>([^<]+)<\/lastmod>/gi);
  assert.equal(locations.length, 25);
  assert.equal(lastmods.length, locations.length);
  assert.equal(new Set(locations).size, locations.length);
  for (const location of locations) {
    assert.match(location, /^https:\/\/www\.snackpdf\.com\//);
    assert.doesNotMatch(location, /\/(?:compress|terms|cookies|open-source-licences)$/);
  }
  for (const [index, date] of lastmods.entries()) {
    const isNewFeature = /\/(?:ocr-pdf|redact-pdf|fill-pdf-form)$/.test(locations[index]);
    const isPasswordProtection = /\/protect-pdf$/.test(locations[index]);
    const updatedRoutes = ["https://www.snackpdf.com/", "https://www.snackpdf.com/ocr-pdf", "https://www.snackpdf.com/redact-pdf", "https://www.snackpdf.com/fill-pdf-form"];
    assert.equal(date, updatedRoutes.includes(locations[index]) ? "2026-09-30" : isPasswordProtection ? "2026-09-17" : isNewFeature ? "2026-09-16" : locations[index].endsWith("/support") ? "2026-09-04" : "2026-08-31");
  }
});

test("internal links resolve and structured data matches visible routes", () => {
  for (const route of ROUTES) {
    const html = readRoute(route);
    for (const href of matches(html, /<a\b[^>]* href="([^"]+)"/gi)) {
      if (!href.startsWith("/") || href.startsWith("//")) continue;
      const pathname = href.split(/[?#]/)[0] || "/";
      const resolves = ROUTES.includes(pathname) || existsSync(new URL(`../static-site${pathname}`, import.meta.url));
      assert.equal(resolves, true, `${route} contains broken internal link ${href}`);
    }

    const scripts = matches(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi).map((source) => JSON.parse(source));
    assert.ok(scripts.length >= 1, `${route} structured data is missing`);
    if (route !== "/") {
      const breadcrumb = scripts.find((value) => value["@type"] === "BreadcrumbList");
      assert.ok(breadcrumb, `${route} BreadcrumbList is missing`);
      assert.equal(breadcrumb.itemListElement.at(-1).item, `${ORIGIN}${route}`);
      assert.match(plainText(html), new RegExp(breadcrumb.itemListElement.at(-1).name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  }

  const homepage = readRoute("/");
  const graph = matches(homepage, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)
    .map((source) => JSON.parse(source))
    .flatMap((value) => value["@graph"] ?? [value]);
  const list = graph.find((value) => value["@type"] === "ItemList");
  assert.ok(list, "Homepage ItemList is missing");
  assert.deepEqual(list.itemListElement.map((item) => new URL(item.url).pathname), HOME_TOOL_ROUTES);

  const directories = matches(homepage, /<div class="tool-directory">([\s\S]*?)<\/div>/gi);
  assert.equal(directories.length, 4, "Four task groups must be visible");
  const directoryRoutes = directories.flatMap((directory) => matches(directory, /<a\b[^>]* href="([^"]+)"/gi));
  assert.deepEqual(directoryRoutes, HOME_TOOL_ROUTES);
  assert.deepEqual([...directoryRoutes].sort(), [...TOOL_ROUTES].sort(), "Every tool must remain discoverable exactly once");
  for (const id of ["optimise", "organise", "convert", "security"]) {
    assert.match(homepage, new RegExp(`href="#${id}"`));
    assert.match(homepage, new RegExp(`id="${id}"`));
  }
});

test("release content contains no fabricated or manipulative search claims", () => {
  const allHtml = ROUTES.map(readRoute).join("\n");
  assert.doesNotMatch(allHtml, /"@type":"(?:Review|AggregateRating|Offer)"/i);
  assert.doesNotMatch(allHtml, /(?:adobe|ilovepdf|smallpdf|pdf24)/i);
  assert.doesNotMatch(allHtml, /<script[^>]+src="https?:\/\//i);
  assert.doesNotMatch(readRoute("/"), /buymeacoffee\.com/i);
  assert.doesNotMatch(one(readRoute("/rebuild-pdf"), /<title>([^<]+)<\/title>/i, "Rebuild title"), /repair/i);
  assert.match(one(readRoute("/pdf-to-text"), /<meta name="description" content="([^"]+)"/i, "Text description"), /does not perform OCR/i);
  assert.match(plainText(readRoute("/unlock-pdf")), /does not guess, crack, bypass or recover/i);
});
