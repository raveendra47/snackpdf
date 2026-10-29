import { PrivacyPanel } from "./components/privacy-panel";
import { ServiceWorkerRegistration } from "./components/service-worker-registration";
import { SiteFrame } from "./components/site-frame";
import { TOOL_BY_SLUG, TOOLS } from "./lib/catalog";

const HOME_TOOL_ORDER = [
  "compress-pdf",
  "merge-pdf",
  "split-pdf",
  "pdf-to-jpg",
  "rebuild-pdf",
  "grayscale-pdf",
  "extract-pages",
  "remove-pages",
  "reorder-pages",
  "pdf-to-png",
  "pdf-to-text",
  "ocr-pdf",
  "redact-pdf",
  "fill-pdf-form",
  "protect-pdf",
  "unlock-pdf",
] as const;

const homeTools = HOME_TOOL_ORDER.map((slug) => TOOL_BY_SLUG.get(slug)).filter((tool): tool is (typeof TOOLS)[number] => Boolean(tool));

const homeToolCopy: Record<string, { title: string; description: string }> = {
  "compress-pdf": { title: "Compress PDF", description: "Reduce file size while choosing your preferred quality." },
  "merge-pdf": { title: "Merge PDFs", description: "Combine multiple documents in the order you choose." },
  "split-pdf": { title: "Split PDF", description: "Save every page as a separate PDF document." },
  "pdf-to-jpg": { title: "PDF to JPG", description: "Turn PDF pages into clear, shareable images." },
  "rebuild-pdf": { title: "Rebuild PDF", description: "Create a fresh copy from readable PDF content." },
  "grayscale-pdf": { title: "Grayscale PDF", description: "Convert document colours into shades of grey." },
  "extract-pages": { title: "Extract pages", description: "Save selected pages in any order you choose." },
  "remove-pages": { title: "Remove pages", description: "Delete unwanted pages using local previews." },
  "reorder-pages": { title: "Reorder pages", description: "Arrange every PDF page into a new order." },
  "pdf-to-png": { title: "PDF to PNG", description: "Render PDF pages as crisp PNG images." },
  "pdf-to-text": { title: "Extract text", description: "Extract selectable text already stored in a PDF. For scans, use OCR." },
  "ocr-pdf": { title: "OCR scanned PDF", description: "Recognise printed English text in scanned pages. Review the result for errors." },
  "redact-pdf": { title: "Redact PDF content", description: "Remove selected page areas permanently on your device." },
  "fill-pdf-form": { title: "Fill PDF form", description: "Complete existing PDF form fields locally." },
  "protect-pdf": { title: "Password-protect PDF", description: "Add AES-256 protection without uploading the file." },
  "unlock-pdf": { title: "Unlock PDF", description: "Create an unlocked copy using a known password." },
};

const toolGroups = [
  { group: "Optimise", title: "Reduce size & change appearance", id: "optimise" },
  { group: "Organise", title: "Organise pages & fill forms", id: "organise" },
  { group: "Convert", title: "Convert to images & text", id: "convert" },
  { group: "Security", title: "Redact & protect documents", id: "security" },
] as const;

const directoryTools = toolGroups.flatMap(({ group }) => homeTools.filter((tool) => tool.group === group));

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: "SnackPDF",
      url: "https://www.snackpdf.com/",
      description: "Private PDF tools that process documents on the device and work offline after preparation.",
    },
    {
      "@type": "WebApplication",
      name: "SnackPDF",
      url: "https://www.snackpdf.com/",
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Any modern web browser",
      description: "Private PDF tools that process documents locally in the browser and work offline after the application is ready.",
    },
    {
      "@type": "ItemList",
      name: "SnackPDF tools",
      numberOfItems: homeTools.length,
      itemListElement: directoryTools.map((tool, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: tool.title,
        url: `https://www.snackpdf.com/${tool.slug}`,
      })),
    },
  ],
};

export default function Home() {
  return (
    <SiteFrame showOfflineStatus={false}>
      <main id="main-content" className="home-main">
        <section className="home-directory" aria-labelledby="directory-heading">
          <div className="home-intro">
            <span className="kicker">All PDF tools</span>
            <h1 id="directory-heading">What do you need to do?</h1>
            <p>Edit, organise and convert PDFs on your device. No upload or account needed. Choose a tool to begin.</p>
            <ServiceWorkerRegistration />
          </div>
          <nav className="tool-group-nav" aria-label="Find a PDF tool">
            {toolGroups.map(({ title, id }) => <a href={`#${id}`} key={id}>{title}</a>)}
          </nav>
          {toolGroups.map(({ group, title, id }) => (
            <section className="tool-group" id={id} key={id} aria-labelledby={`${id}-heading`}>
              <h2 id={`${id}-heading`}>{title}</h2>
              <div className="tool-directory">
                {homeTools.filter((tool) => tool.group === group).map((tool) => {
                  const copy = homeToolCopy[tool.slug] ?? { title: tool.title, description: tool.description };
                  return (
                    <a className="tool-directory-entry" href={`/${tool.slug}`} key={tool.slug} aria-label={`${copy.title}. ${copy.description}`}>
                      <span className="tool-copy">
                        <span className="tool-name">{copy.title}</span>
                        <span className="tool-summary">{copy.description}</span>
                      </span>
                    </a>
                  );
                })}
              </div>
            </section>
          ))}
        </section>
        <PrivacyPanel />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      </main>
    </SiteFrame>
  );
}
