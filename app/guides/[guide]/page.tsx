import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFrame } from "../../components/site-frame";

interface GuideDefinition {
  title: string;
  seoTitle: string;
  description: string;
  body: React.ReactNode;
}

export const GUIDES = {
  "compress-pdf-without-uploading": {
    title: "How to compress a PDF without uploading it",
    seoTitle: "How to Compress a PDF Without Uploading It | SnackPDF",
    description: "A practical guide to compressing a PDF locally in your browser, checking that no upload occurs, choosing a profile and reviewing the saved result.",
    body: <>
      <p>SnackPDF compresses a PDF in your browser with a bundled Ghostscript WebAssembly engine. The selected file is passed to a dedicated browser Worker and an in-memory filesystem; it is not sent to SnackPDF for processing.</p>
      <h2>Compress the file locally</h2>
      <ol>
        <li>Open the <a href="/compress-pdf">private PDF compressor</a>.</li>
        <li>Wait for the site status to say “Ready for offline use” if you also want to use the tool without a connection.</li>
        <li>Choose one PDF. SnackPDF shows the name and size before processing.</li>
        <li>Choose Light, Balanced or Smallest. Light favours image quality; Smallest applies the strongest image downsampling.</li>
        <li>Select “Compress PDF”, then download the new file. The original remains unchanged.</li>
      </ol>
      <h2>Check that no upload occurred</h2>
      <p>For a repeatable check, open your browser&apos;s developer tools and clear the Network panel before choosing a synthetic or non-sensitive PDF. Complete the operation and confirm that the document name, contents and password do not appear in outgoing requests. SnackPDF&apos;s own release suite performs a stricter version of this test; the exact boundary and fixtures are described on <a href="/how-snackpdf-is-tested">How SnackPDF is tested</a>.</p>
      <h2>Review the result</h2>
      <p>Compression is a rewrite, not a byte-for-byte edit. Images can be resampled and comments, forms, bookmarks, links, metadata or other structures may change. A short or already compressed PDF may stay similar in size or become larger. Keep the original and inspect the saved copy at the zoom level and in the workflow that matter.</p>
      <p>Read the <a href="/privacy">privacy boundary</a> and <a href="/guides/use-pdf-tools-offline">offline PDF tools guide</a> for related checks.</p>
    </>,
  },
  "verify-local-pdf-processing": {
    title: "How to verify that a PDF tool processes files locally",
    seoTitle: "How to Verify Local PDF Processing | SnackPDF",
    description: "Learn practical browser checks for local PDF processing: inspect network requests, browser storage, offline behaviour and the tool's published test evidence.",
    body: <>
      <p>A “private” label is not enough to prove where document processing happens. You can test useful parts of the claim with a synthetic PDF, browser developer tools and an offline run. These steps mirror the evidence SnackPDF uses for its browser-local implementation.</p>
      <h2>1. Use a safe test document</h2>
      <p>Create a PDF containing a unique phrase and a harmless filename, or use the <a href="/snackpdf-sample.pdf" download>SnackPDF sample PDF</a>. Never begin an investigation with a confidential document.</p>
      <h2>2. Watch network requests</h2>
      <ol>
        <li>Open the browser&apos;s Network panel and clear existing entries.</li>
        <li>Choose the test PDF and complete an operation such as <a href="/compress-pdf?sample=1">compressing the sample locally</a>.</li>
        <li>Inspect request URLs, methods and payloads. The file name, unique phrase and PDF bytes should not leave the page for processing.</li>
      </ol>
      <p>Ordinary requests for the application, its WebAssembly engine and managed hosting can still occur while online. The meaningful question is whether document data is transmitted.</p>
      <h2>3. Inspect browser storage</h2>
      <p>Check localStorage, IndexedDB and Cache Storage. An offline-first tool may cache its application files, but it should not persist your selected PDF or finished result unless it clearly says so. SnackPDF caches routes, scripts, styles and its local engine; selected and generated documents stay out of persistent application storage.</p>
      <h2>4. Repeat the complete task offline</h2>
      <p>After the tool says it is ready, disconnect from the network, reopen a cached page and finish the same operation. Successful offline processing is strong evidence that the document transformation does not depend on a processing server, though it cannot audit browser extensions, the operating system or hosting infrastructure.</p>
      <h2>5. Look for reproducible evidence</h2>
      <p>Prefer a precise processing boundary, source and licence information, named limitations and tests that use unique markers. SnackPDF publishes its <a href="/how-snackpdf-is-tested">network, storage, determinism, fidelity and offline checks</a>, its <a href="/open-source-licences">source and licences</a>, and its <a href="/privacy">privacy explanation</a>.</p>
    </>,
  },
  "use-pdf-tools-offline": {
    title: "How to use PDF tools offline without Wi-Fi",
    seoTitle: "How to Use PDF Tools Offline Without Wi-Fi | SnackPDF",
    description: "Prepare SnackPDF once, verify its offline cache, disconnect from Wi-Fi and complete a local PDF task without installing an app or uploading a file.",
    body: <>
      <p>SnackPDF is an offline-first website. It needs a connection to download the complete application once, including its PDF engine, but installation as a PWA is optional. After preparation, supported PDF jobs can run without Wi-Fi.</p>
      <h2>Prepare the complete application</h2>
      <ol>
        <li>Open SnackPDF while online and keep the page open.</li>
        <li>Wait until the status changes to “Ready for offline use”. This appears only after every route and the local processing engine have been cached together.</li>
        <li>Optionally download the <a href="/snackpdf-sample.pdf" download>synthetic sample PDF</a> so you can test without an important document.</li>
      </ol>
      <h2>Run a task without Wi-Fi</h2>
      <ol>
        <li>Turn off Wi-Fi, enable airplane mode or use the browser&apos;s offline network control.</li>
        <li>Reopen a cached tool such as <a href="/compress-pdf?sample=1">Compress PDF with the sample</a>.</li>
        <li>Choose the file, complete the operation and save the result through the browser&apos;s normal download behaviour.</li>
      </ol>
      <p>The result can be saved offline because it is created on the device. Selected and finished documents are not stored in SnackPDF&apos;s application cache.</p>
      <h2>Know what can interrupt offline use</h2>
      <p>Private browsing, cleared site data, browser storage pressure or an incomplete first preparation can remove or prevent the cache. Large PDFs, many pages and high-resolution image output may exceed the memory available on a phone or tablet even when every application file is present. Reconnect and reload if the ready status never appeared.</p>
      <p>For the exact cached boundary, read <a href="/offline-use">Offline use</a>. To audit the behaviour yourself, follow the <a href="/guides/verify-local-pdf-processing">local-processing verification guide</a> and compare it with <a href="/how-snackpdf-is-tested">SnackPDF&apos;s release evidence</a>.</p>
    </>,
  },
} satisfies Record<string, GuideDefinition>;

type GuideSlug = keyof typeof GUIDES;

export function generateStaticParams() {
  return Object.keys(GUIDES).map((guide) => ({ guide }));
}

export async function generateMetadata({ params }: { params: Promise<{ guide: string }> }): Promise<Metadata> {
  const { guide } = await params;
  const definition = GUIDES[guide as GuideSlug];
  if (!definition) return {};
  const pathname = `/guides/${guide}`;
  return {
    title: definition.seoTitle,
    description: definition.description,
    alternates: { canonical: pathname },
    openGraph: { type: "article", siteName: "SnackPDF", title: definition.seoTitle, description: definition.description, url: pathname, images: [] },
    twitter: { card: "summary", title: definition.seoTitle, description: definition.description, images: [] },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ guide: string }> }) {
  const { guide } = await params;
  const definition = GUIDES[guide as GuideSlug];
  if (!definition) notFound();
  const pathname = `/guides/${guide}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "SnackPDF", item: "https://www.snackpdf.com/" },
      { "@type": "ListItem", position: 2, name: "Guides", item: "https://www.snackpdf.com/guides/compress-pdf-without-uploading" },
      { "@type": "ListItem", position: 3, name: definition.title, item: `https://www.snackpdf.com${pathname}` },
    ],
  };
  return <SiteFrame><article id="main-content" className="guide-article">
    <nav className="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="/">SnackPDF</a></li><li><a href="/guides/compress-pdf-without-uploading">Guides</a></li><li aria-current="page">{definition.title}</li></ol></nav>
    <h1>{definition.title}</h1>
    {definition.body}
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
  </article></SiteFrame>;
}
