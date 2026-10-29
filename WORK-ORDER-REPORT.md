# SnackPDF work-order report

Date: 2026-09-17  
Site: <https://www.snackpdf.com>  
Repository: SnackPDF Sites project

## Executive summary

Phase 8 ships browser-local AES-256 password protection, with separate open and
owner passwords, advisory reader permissions, and no RC4 fallback. The MIT
implementation is vendored at an exact version and linked from the licence
page. The existing unlock flow now authenticates the password with the local
PDF.js reader before asking the PDF engine to create an unlocked copy, so a
wrong password fails instead of producing a misleading output.

The homepage performance investigation found no PDF engine on the homepage
critical path and no long main-thread task. The application-controlled issue
was that the HTML response was explicitly non-cacheable at the edge. The
Worker now permits short browser revalidation and a five-minute shared edge
cache with stale-while-revalidate. Cloudflare’s challenge-platform request is
still host-managed and was observed after first content rather than blocking
the application’s first paint.

The phase-7 handover’s claim of “flat” AcroForm filling has been corrected. The
existing-field form flow remains live/editable; only the deliberate fallback
for PDFs without usable fields places static marks. No flattening claim is made.

One source-of-truth limitation remains: `ENCRYPTION-DECISION.md` was not
present in the checkout or reachable git history. The implementation followed
the exact `@pdfsmaller/pdf-encrypt` 1.2.0 choice recorded in the prior report and
the phase brief, but this missing document should be restored by the project
owner. The requested qpdf executable was also not available in this Windows
environment, so the qpdf-specific acceptance comparison is recorded as not
run rather than claimed.

## Phase table

| Phase | Result | Commit |
| --- | --- | --- |
| 1. Survey | Stack, routing, hosting, licences, runtime boundary, and network boundary documented in `SURVEY.md`. | `fc6d1e3c5e5f8b63d2722610a0c58dfe474b1742` |
| 2. Canonical homepage | `https://www.snackpdf.com` is served directly with 200; canonical host redirects remain intentional. | `74b44d622260a35d684e050d96b8a1152a46cabb` |
| 3. Performance | Homepage workspace deferred; Phase 8 adds measured HTML edge caching and records the remaining host-managed challenge behavior below. | `42a7a8c1aef2c103177c0ea507fef4d2f9c2799b` |
| 4. OCR | `/ocr-pdf`: browser-local PDF.js rendering, bundled English Tesseract OCR, confidence display, copy, and `.txt` download. | `9169db7ef01792420bae6c833a9203c6c0ad42ab` |
| 5. Redaction | `/redact-pdf`: affected-page raster redaction with an explicit irreversible-loss warning. | `9169db7ef01792420bae6c833a9203c6c0ad42ab` |
| 6. Form filling | `/fill-pdf-form`: existing live AcroForm fields plus a static fallback for PDFs without usable fields; no flattening claim. | `9169db7ef01792420bae6c833a9203c6c0ad42ab` |
| 7. Password protection | **SHIPPED.** `/protect-pdf` writes AES-256 PDF 2.0 encryption locally using the exact vendored 1.2.0 module. | This release |
| 8. Dialegein attribution | Footer says SnackPDF is listed by Dialegein and links to `https://dialegein.com` without `nofollow`. | `daf0fa811c5544af237e6144f84934ba75182156` |
| 9. Out of scope | No server, upload path, third-party runtime request, or automatic-download replacement was added. | — |

## Phase 8 — password protection

### Implementation

`@pdfsmaller/pdf-encrypt@1.2.0` is pinned exactly and vendored under
`app/lib/vendor/pdf-encrypt/`. Its upstream copyright headers and MIT notice
are preserved. The notice is published at
`/legal/PDF-ENCRYPT-MIT.txt`, referenced by `/open-source-licences`,
`legal/open-source.md`, the third-party notices, and release-inventory tests.

`app/lib/pdf-encrypt.ts` only calls the AES-256 path. It throws when the page is
not a secure context or when `crypto.subtle` is unavailable; it does not
downgrade to RC4. The tool exposes open and optional owner passwords and the
reader permission flags for printing, copying, modification, annotation, form
filling, accessibility extraction, and assembly.

The UI says that permissions are advisory and can be ignored by a determined
tool. It also says that encryption is not redaction: anyone with the open
password can see content that was only covered. Passwords are cleared after
processing. The unlock path validates the entered password with the local
PDF.js reader before invoking Ghostscript, avoiding a misleading output when a
wrong password is supplied.

### Acceptance record

- **Five round trips:** a form-heavy fixture was encrypted five times through
  the vendored implementation. The ciphertext differed on every run. PDF.js
  opened all five with the open password, and the extracted body text, dotted
  field name/value, checkbox value, title, and author matched the source.
- **Fixture coverage:** the fixture included AcroForm fields, the dotted name
  `person.name`, metadata, and body text containing parentheses and backslashes.
- **Encryption markers:** each result was inspected for `/V 5`, `/R 6`, and
  `/CFM /AESV3`. A qpdf comparison was not run because qpdf is not installed in
  this environment; this is the remaining acceptance gap.
- **External reader:** Chrome’s built-in PDF viewer opened the generated file,
  displayed its password prompt, accepted the correct password, rendered the
  page, and displayed “Incorrect password” for the wrong password. Third-party
  PDF.js text extraction confirmed the output retains text rather than being
  rasterised. Acrobat Reader and macOS Preview were not available here.
- **Wrong password:** the real `/protect-pdf` UI test downloads the result, and
  the real `/unlock-pdf` UI rejects a wrong password with an alert and no Done
  result. The independent Node test also rejects the wrong password.
- **Locality:** the protection-flow browser test recorded no external HTTP
  request and no request body. The full browser suite’s 100-request regression
  remained same-origin.

The acceptance tests are in `tests/encryption.test.mjs`,
`tests/protect-contract.test.mjs`, and the protection case in
`tests/browser/desktop.spec.mjs`.

## Phase 8 — homepage performance investigation

Measurements were taken against the canonical production URL with direct HTTP
requests and Chromium performance entries. Values vary because the hosting
edge sometimes adds a challenge or cold-start delay.

1. **Origin TTFB:** a direct origin measurement was not possible. DNS exposes
   Cloudflare/custom-domain edge addresses (`www.snackpdf.com` CNAMEs to
   `custom-domains.chatgpt.site`); no application origin address is published.
   Ten direct edge samples were 229.2, 61.7, 56.0, 70.8, 69.6, 64.9, 94.2,
   99.6, 1790.1, and 80.1 ms. The sample median was approximately 75 ms, with
   a clear cold/outlier tail.
2. **HTML CDN behavior:** before the fix, HTML returned `Server: cloudflare`,
   `Cache-Control: public, must-revalidate, max-age=0`, and no
   `CF-Cache-Status` or `Age` header. The Worker now returns
   `public, max-age=60, s-maxage=300, stale-while-revalidate=86400`, allowing
   shared edge reuse while keeping browser content fresh within one minute.
3. **Initial JavaScript:** the homepage loaded five first-party JavaScript
   resources before it was usable, approximately 87.3 KB transferred and
   approximately 276 KB uncompressed in the measured build. The PDF engine,
   OCR runtime, and tool workspace were not loaded on the homepage. Three
   Chromium runs observed zero buffered long tasks over 50 ms; warm response to
   first content was approximately 0.2–0.5 seconds after response start.
4. **Bot management:** Chromium observed
   `/cdn-cgi/challenge-platform/scripts/jsd/main.js` (302 then 200) and a
   follow-up `oneshot` request. In the observed run those requests started
   after DOM/load and first content, so they add host-managed work but were not
   the application’s blocking first-paint cause. The application cannot remove
   that layer without changing the managed hosting boundary.

The largest application-controlled issue was the non-cacheable HTML policy.
The fix is the Worker cache header above. Post-deployment verification against
the same `www` URL returned the new header and `/protect-pdf` returned 200. Ten
post-deployment edge samples were 2028.0, 114.2, 104.6, 85.8, 88.1, 87.8,
82.5, 96.6, 107.2, and 78.1 ms; the median was approximately 92 ms. The cold
sample remained about 2.03 seconds, and `CF-Cache-Status` and `Age` were still
absent. Three Chromium navigations measured response starts of 149, 313, and
516 ms and DOM-interactive times of 334, 477, and 752 ms.

This is an honest partial performance fix: the application now publishes an
edge-cacheable HTML policy, but managed hosting does not expose a cache-status
confirmation and the host-managed challenge/cold path still produces the long
tail. Removing that remaining round trip would require changing the managed
Cloudflare bot-management configuration, which is outside the site source.

## Flattening decision

Flattening was **not implemented**. The form page and support copy now say that
existing AcroForm fields remain live and editable and that this tool does not
flatten them. The no-field fallback is explicitly static. The report and user
copy no longer claim “AcroForm/flat form filling”.

## Completion-control contract

The compress tool still shows a visible `Download` link only after processing
has completed. It does not hover-hide the control, delay it beyond the normal
job completion, or trigger an automatic download. The release contract test
checks this because the Dialegein verifier uses that control to confirm that a
tool ran.

## User-visible changes and Dialegein update list

The independent index’s product record needs an update after this release:

- Add **Protect PDF with a password** as the sixteenth tool.
- Remove or revise the stale statement that SnackPDF can remove a password but
  cannot put one on a PDF.
- Add the tested AES-256 capability, separate open/owner passwords, and the
  advisory-permission caveat.
- Preserve the distinction that encryption is not redaction and that the
  redaction tool removes content by rasterising affected pages.
- Keep the existing OCR, redaction, and form-filling descriptions current;
  form filling should not be described as flattening.

The unlock wrong-password validation, homepage edge-cache behavior, and the
unchanged visible download control do not require new product-record claims.
The Dialegein pages are external and were not edited by this release.

## Verification record

Passed:

- Direct Vinext production build on Windows, using the underlying build steps
  because the repository’s WSL `bash` wrapper is unavailable in this runtime.
- OCR asset preparation, service-worker versioning, source archive generation,
  static export, and release inventory: 28 routes, 77 release files, and 126
  normalized source files.
- TypeScript type check.
- Full Node test suite: 48 tests passed.
- Chromium desktop browser suite: 7 tests passed.
- Chromium mobile browser suite: 2 tests passed.
- Real UI protection flow: download, AES-256 markers, wrong-password failure,
  and no external request.
- Five-run form-heavy AES-256 round trip and independent PDF.js decryption.
- Chrome built-in PDF viewer prompt, correct-password rendering, and wrong-
  password error.
- 100-request same-origin locality regression.
- Visible post-processing download-control contract for compress.
- Production metadata, legal notice, service-worker, privacy, and release
  inventory contracts.

Not run / unavailable:

- qpdf comparison and qpdf five-run acceptance, because no qpdf executable is
  installed in this environment.
- Acrobat Reader and macOS Preview, because neither is available here.
- Direct origin TTFB, because the managed edge does not expose an origin
  address.

## Network, privacy, and offline audit

The client source contains no document upload endpoint, document telemetry,
analytics, error reporting, persistent document storage, or third-party runtime
asset URL. The server policy allows only same-origin connections and rejects
write methods. OCR assets, language data, renderer, engine, and worker files
are served from this origin and included in the offline release inventory.

The app’s own runtime references are same-origin. The live hosting edge may add
its challenge-platform script and short-lived anti-abuse cookie; that is
host-managed delivery behavior, not a document-processing request. The
browser privacy audit observed no external requests while the advertised
operations completed.

The 100-request same-origin check is in the browser suite and is part of the
release test command rather than a one-off measurement.

## Known limits

- `ENCRYPTION-DECISION.md` is missing from the checkout/history and should be
  restored; this report does not pretend it was read.
- qpdf, Acrobat Reader, and Preview were unavailable for this run.
- OCR is English-only and its accuracy claim is limited to the controlled
  image-only fixture.
- Redaction rasterises affected pages and does not claim complete metadata,
  attachment, annotation, signature, or hidden-content sanitisation.
- Form support is limited to fields exposed by pdf-lib; XFA, signatures,
  unusual widgets, and protected forms are not handled.
- Existing form fields are not flattened.
- No user document is stored or uploaded, but users should review sensitive
  output files and their local browser/download environment.

## Extra changes made to keep the release coherent

- Added the vendored encryption module, secure-context guard, protection UI,
  exact MIT notice, and contract/round-trip/browser tests.
- Added the unlock password-authentication gate using the already self-hosted
  PDF.js worker path.
- Added the homepage HTML edge-cache policy and a test for its exact header.
- Corrected form copy and the handover so flattening is not claimed.
- Added the protection route to metadata, sitemap, service-worker, offline
  inventory, mobile routes, and legal/source coverage.
- Kept the compress download control visible and covered by a release test.
