import type { LegalSlug } from "../lib/catalog";

const sourceCommit = "a62b7d686b21cf88f6425b3e989d1062b9af4256";

export function LegalPage({ slug }: { slug: LegalSlug }) {
  if (slug === "how-snackpdf-is-tested") {
    return (
      <Article title="How SnackPDF is tested">
        <p className="verification-date"><strong>Last verified:</strong> 31 August 2026 · <strong>Test material:</strong> synthetic PDFs only</p>
        <p>SnackPDF says that supported PDF jobs run in your browser. That claim is narrower than “the website makes no network requests”: the application still has to be delivered, and managed hosting can handle ordinary request information. The tested claim is that SnackPDF application code does not send the selected document, its name, password, extracted text, metadata or hash away for processing.</p>

        <h2>Processing boundary</h2>
        <p>A selected PDF is read into memory in the current tab and transferred to a dedicated browser Worker. The Worker loads the processing program from SnackPDF&apos;s own origin and uses an in-memory virtual filesystem. Inputs and outputs are cleared after completion, cancellation or reset; the saved result is offered through the browser&apos;s normal download behaviour.</p>
        <p>The release checks reject document telemetry APIs, upload forms, persistent document storage and third-party runtime requests. The site&apos;s security policy also restricts connections and Workers to the same origin.</p>

        <h2>Network and storage inspection</h2>
        <p>The browser suite uses synthetic fixtures containing unique markers for a filename, visible text, metadata, password and document hash. It records browser requests and instruments <code>fetch</code>, XMLHttpRequest, WebSocket, EventSource, <code>sendBeacon</code> and form submission while every advertised operation completes.</p>
        <p>The same run inspects localStorage, IndexedDB and every Cache Storage response. A release fails if a marker or fixture byte sequence appears in a request, URL, console record or persistent browser store. Cache Storage is allowed to contain the application itself, but never a selected or finished document.</p>

        <h2>Determinism and output checks</h2>
        <p>Each shipped transformation is run three times against known fixtures. The tests compare output names and SHA-256 hashes, reopen PDF results, count their pages and confirm the requested order. Split is checked for one reopenable PDF per page; text extraction is checked against both stored text and an image-only fixture that must truthfully produce an empty result.</p>
        <p>Fidelity fixtures contain colour, vector shapes, text and mixed page boxes. Compression profiles are checked against fixed rendered-difference limits. The grayscale check renders the output and verifies effectively equal red, green and blue channels. These checks support the stated behaviour, but they do not prove that every interactive PDF structure is preserved.</p>

        <h2>Offline, browser and accessibility gates</h2>
        <p>The Service Worker treats the complete application as one version. Every route, script, style and local processing asset must be cached before “Ready for offline use” appears. Browser tests then disconnect the network, reopen the routes and process a fixture locally.</p>
        <p>The release matrix covers Chromium, Firefox and WebKit, plus phone-sized Chromium and WebKit runs. It checks one H1 per route, visible focus, the skip link, keyboard page ordering, touch-sized controls, narrow layouts, deterministic downloads and the complete offline workflow.</p>

        <h2>Known limits</h2>
        <ul>
          <li>The processing WebAssembly file is 15,533,045 bytes before transfer compression, so the first complete offline installation is much larger than the visible page.</li>
          <li>Large files, many pages and 300-DPI images can exceed practical browser memory. SnackPDF estimates memory and stops rather than knowingly starting an unsafe job.</li>
          <li>Synthetic fixtures cannot represent every valid or malformed PDF. Keep the original and inspect every important output.</li>
          <li>Browser extensions, the operating system and hosting infrastructure sit outside SnackPDF application code and its document-processing tests.</li>
        </ul>

        <h2>Reproduce the checks</h2>
        <ol>
          <li>Use a synthetic or otherwise non-sensitive PDF and open the browser&apos;s Network panel before selecting it.</li>
          <li>Complete the intended operation and confirm that document markers do not appear in requests.</li>
          <li>Inspect localStorage, IndexedDB and Cache Storage; only application files should persist.</li>
          <li>Wait for the offline-ready message, disconnect, reopen a tool and process the fixture again.</li>
          <li>Download the <a href="/source/snackpdf-source.tar.gz">corresponding source</a>, verify its <a href="/source/snackpdf-source.tar.gz.sha256">checksum</a> and run the documented release suite for the exact implementation.</li>
        </ol>
        <p>Licence materials and source traceability are listed on <a href="/open-source-licences">Source and licences</a>. You can also follow the <a href="/guides/verify-local-pdf-processing">practical local-processing verification guide</a>, read the <a href="/privacy">privacy boundary</a> and review <a href="/offline-use">offline preparation</a>. Results on this page are updated only when the described release checks are run again.</p>
      </Article>
    );
  }

  if (slug === "about") {
    return (
      <Article title="About">
        <p>SnackPDF today is a compact, free collection of browser-local PDF tools maintained as an independent project. It is designed for people who want to process a document on their own device without creating an account or uploading the file for processing.</p>
        <p>The current browser-local, offline-first rebuild was released in August 2026. Its tools use Ghostscript compiled to WebAssembly inside a dedicated browser Worker.</p>
        <h2>Local and offline by design</h2>
        <p>Document operations run in a dedicated browser Worker using the application&apos;s bundled WebAssembly engine. After the complete application is ready, its tools can be reopened and used offline. Read the <a href="/privacy">privacy boundary</a>, <a href="/offline-use">offline instructions</a> and <a href="/how-snackpdf-is-tested">release test evidence</a> for the implementation details.</p>
        <h2>Deliberate limits</h2>
        <p>SnackPDF does not currently provide accounts, a paid-credit system, document storage, server-side document processing, a document-processing API, AI features or email collection.</p>
        <h2>Earlier versions</h2>
        <p>Older third-party descriptions may refer to previous or experimental versions, including paid credits, server processing or an API. They do not describe the August 2026 rebuild.</p>
        <p>This website is the authoritative current product description. Its <a href="/open-source-licences">source, licence and checksum information</a> identifies the implementation shipped with the current release.</p>
        <h2>Support and developer resources</h2>
        <p>SnackPDF is free to use. If it has saved you time, you can <a href="https://buymeacoffee.com/calumkerr" rel="external">support Calum Kerr&apos;s independent work</a>.</p>
        <p>For developers, the separate <a href="https://buymeacoffee.com/calumkerr/e/569210" rel="external">Local-First Web App Release Pack</a> contains the handbook, release gates and testing materials developed from the lessons behind SnackPDF.</p>
        <p>These external pages require an internet connection.</p>
      </Article>
    );
  }

  if (slug === "privacy") {
    return (
      <Article title="Privacy">
        <p>SnackPDF processes the documents you choose locally in your browser. Documents are not intentionally transferred to SnackPDF for processing.</p>
        <h2>What the service does not have</h2>
        <p>There are no user accounts, document storage service, analytics, advertising trackers, behavioural profiles or document processing API. SnackPDF does not keep a cloud copy of a selected or finished document.</p>
        <h2>Normal website delivery</h2>
        <p>When you first visit the website, normal network information such as your IP address may reach the hosting infrastructure so it can deliver the application files. Managed hosting may also apply a short-lived anti-abuse cookie. SnackPDF application code does not put document names, document contents, passwords or document hashes into those requests.</p>
        <h2>Local processing and memory</h2>
        <p>Selected documents are read into memory in this browser tab and passed only to a local processing worker. Temporary input and output files use an in-memory virtual filesystem. They are cleared after the operation, when you start again, or when the worker is stopped. SnackPDF does not put document contents in localStorage, IndexedDB or the Service Worker cache.</p>
        <h2>Offline use</h2>
        <p>After the application has been cached successfully, the document tools can work offline. Application caching stores SnackPDF itself, including its processing program. It does not store your documents.</p>
        <h2>Recovery</h2>
        <p>SnackPDF cannot recover a document after the tab is closed because it never receives a copy. Keep the original file until you have checked the result.</p>
        <p>No operator address, registration number or contact email has been added because none was supplied in the production configuration.</p>
        <p>For further evidence, see <a href="/how-snackpdf-is-tested">how local processing is tested</a>, the <a href="/guides/verify-local-pdf-processing">independent checks you can perform</a> and the <a href="/offline-use">offline-use instructions</a>.</p>
      </Article>
    );
  }

  if (slug === "support") {
    return (
      <Article title="Support SnackPDF">
        <p>SnackPDF is independently maintained. The core PDF tools remain free, browser-local and available without an account.</p>
        <h2>What support pays for</h2>
        <p>Optional support helps cover development, testing, release work and the ordinary costs of keeping a small independent project available. A contribution does not send your documents anywhere and does not create an account.</p>
        <h2>No artificial friction</h2>
        <p>Support does not unlock a faster queue, remove deliberately imposed limits or give anyone access to remote document processing. SnackPDF is designed to stay straightforward for people who never contribute.</p>
        <h2>Ways to help</h2>
        <p>If you would like to support the project, you can make a <a href="https://buymeacoffee.com/calumkerr" rel="external noopener noreferrer">one-time contribution to the independent maintainer</a>. This external page requires an internet connection.</p>
        <p>Other possible funding models for a privacy-conscious project include non-tracking sponsorship, one-time permanent upgrades, non-expiring credits for genuinely costly advanced operations, or business and API licensing. None of those options is required for the current SnackPDF tools.</p>
        <p>Read <a href="/privacy">how document privacy works</a>, <a href="/offline-use">how offline use is prepared</a> or <a href="/open-source-licences">the source and licence information</a>.</p>
      </Article>
    );
  }

  if (slug === "cookies") {
    return (
      <Article title="Cookies">
        <p>SnackPDF application code does not create cookies. The current managed hosting security layer may set a short-lived <code>__cf_bm</code> cookie to distinguish ordinary requests from automated traffic. SnackPDF does not use it for advertising, analytics or personalisation, and it does not contain document content.</p>
        <h2>Application cache</h2>
        <p>Your browser may store SnackPDF application files locally so the website can continue working offline. Those files include pages, styles, scripts, the local processing program, icons and legal content. They do not contain your documents.</p>
        <p>This application cache is separate from cookies. It is used only to make SnackPDF available offline and to keep application files from being downloaded again unnecessarily.</p>
        <p>A direct deployment using the supplied static-server configuration does not require an application cookie.</p>
      </Article>
    );
  }

  if (slug === "terms") {
    return (
      <Article title="Terms">
        <p>SnackPDF is provided as a software tool. It processes selected files on your device and lets you save the result.</p>
        <h2>Keep the original</h2>
        <p>Keep an original backup. PDF rewriting can change a document&apos;s internal structure and may remove or alter comments, forms, bookmarks, links, metadata or other non-visible features. Check every output before relying on it.</p>
        <h2>Your responsibility</h2>
        <p>You are responsible for having the right to process the files you choose. SnackPDF does not claim ownership of your documents and receives no licence to them because they are not sent to the service.</p>
        <p>Password unlocking is only for documents you are authorised to open. SnackPDF does not guess, recover or crack passwords.</p>
        <p>Password protection uses AES-256 in a secure browser context. Reader permission flags are advisory, and encryption does not remove or redact content; review the protected result in another PDF reader before sharing it.</p>
        <h2>No specialist guarantee</h2>
        <p>SnackPDF does not guarantee that an output is suitable for legal, regulatory, evidential or archival use. No PDF/A output is offered in this release. Service availability and compatibility with every PDF are not guaranteed.</p>
        <h2>Reasonable limits</h2>
        <p>The software is supplied without a promise that every file will process correctly. To the extent the law permits, the operator is not responsible for indirect loss caused by using an unchecked output. Nothing here excludes liability that cannot lawfully be excluded or limits mandatory consumer rights.</p>
        <h2>Applicable law</h2>
        <p>These terms do not choose a different governing law or court. Mandatory rights and the law that would otherwise apply remain unchanged until verified operator details are added.</p>
      </Article>
    );
  }

  if (slug === "offline-use") {
    return (
      <Article title="Offline use">
        <p>SnackPDF is designed to keep working after the network disappears.</p>
        <h2>Prepare once</h2>
        <ol>
          <li>Visit SnackPDF while online. The status changes from “Preparing offline use” to “Ready for offline use” only after the complete application has been cached.</li>
          <li>The complete application, including every tool route and the processing program, is cached together.</li>
          <li>After that, you can disconnect and return to a cached tool page.</li>
        </ol>
        <p>You do not have to install SnackPDF. Installation is an optional browser feature that adds app-like access; the cached website works offline in the browser too.</p>
        <h2>Try a safe sample</h2>
        <p>The <a href="/snackpdf-sample.pdf" download>SnackPDF sample PDF</a> contains only synthetic text and shapes. Wait for the ready status, disconnect, then <a href="/compress-pdf?sample=1">open it in Compress PDF</a> and complete a test job.</p>
        <h2>What is stored</h2>
        <p>The cache holds only SnackPDF application files: pages, styles, scripts, the processing program, icons, the manifest and legal content. It never holds a selected PDF or a finished result.</p>
        <h2>Saving results</h2>
        <p>Finished files are offered through the browser&apos;s normal download behaviour. Saving still works offline because the result is created locally.</p>
        <h2>If offline opening fails</h2>
        <p>If the status says setup is incomplete or failed, reconnect and reload SnackPDF while online. Keep the page open until the ready message appears. A private browsing window, cleared site data or a browser storage limit can remove the cached application.</p>
        <p>For a complete walkthrough, read <a href="/guides/use-pdf-tools-offline">How to use PDF tools offline without Wi-Fi</a>. The <a href="/privacy">privacy page</a> explains what is stored, and <a href="/how-snackpdf-is-tested">How SnackPDF is tested</a> describes the automated offline processing gate.</p>
      </Article>
    );
  }

  return (
    <Article title="Source and licences">
      <p>SnackPDF is distributed in AGPL compatible mode. The application source, build scripts and licence materials are available with this release.</p>
      <ul>
        <li><a href="/source/snackpdf-source.tar.gz" download>Download the SnackPDF corresponding source</a></li>
        <li><a href="/legal/AGPL-3.0.txt">SnackPDF AGPL version 3 licence text</a></li>
        <li><a href="/legal/RUNTIME-MIT-NOTICES.txt">Browser runtime MIT notices</a></li>
        <li><a href="/legal/PDF-ENCRYPT-MIT.txt">Vendored PDF encryption module MIT notice</a></li>
      </ul>
      <h2>Document processing component</h2>
      <p>This release includes Ghostscript 10.06.0 through the pinned package <code>@okathira/ghostpdl-wasm@1.1.0</code>. It is licensed under the GNU Affero General Public License, version 3 or later.</p>
      <ul>
        <li><a href="/legal/GHOSTSCRIPT-AGPL-3.0.txt">Bundled licence text</a></li>
        <li><a href={`https://github.com/okathira/ghostpdl-wasm/tree/${sourceCommit}`}>Exact WebAssembly build source and scripts</a></li>
        <li><a href="https://github.com/ArtifexSoftware/ghostpdl">Upstream GhostPDL source</a></li>
        <li><a href="/engine/checksums.json">Bundled engine checksums</a></li>
        <li><a href="/source/snackpdf-source.tar.gz.sha256">Source archive checksum</a></li>
      </ul>
      <p>The bundled processing files are not presented as a SnackPDF marketing feature. These details are provided for licence compliance and source traceability.</p>
      <h2>PDF encryption module</h2>
      <p>Password protection uses the vendored <code>@pdfsmaller/pdf-encrypt@1.2.0</code> module. It is used for AES-256 PDF encryption in the browser and is distributed under the MIT licence.</p>
      <ul>
        <li><a href="/legal/PDF-ENCRYPT-MIT.txt">MIT licence and copyright notice</a></li>
        <li><a href="https://github.com/smither777/pdf-encrypt/tree/v1.2.0">Upstream source</a></li>
      </ul>
      <h2>Commercial licensing mode</h2>
      <p>This build does not claim a commercial Ghostscript licence. A commercial distribution must be configured only after the distributor has obtained the appropriate rights from Artifex and has reviewed which source and notice obligations change.</p>
    </Article>
  );
}

function Article({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article id="main-content" className="legal-article">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li><a href="/">SnackPDF</a></li>
          <li aria-current="page">{title}</li>
        </ol>
      </nav>
      <h1>{title}</h1>
      {children}
    </article>
  );
}
