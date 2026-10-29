import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { LegalPage } from "../components/legal-page";
import { SiteFrame } from "../components/site-frame";
import { LEGAL_SLUGS, TOOL_BY_SLUG, TOOLS, isLegalSlug, type LegalSlug } from "../lib/catalog";
import { TOOL_CONTENT, TOOL_FACTS } from "../lib/tool-content";

const ToolApp = dynamic(
  () => import("../components/tool-app").then((module) => module.ToolApp),
  { loading: () => <div className="tool-loading" aria-live="polite">Loading the local tool…</div> },
);
const OcrToolApp = dynamic(
  () => import("../components/ocr-tool-app").then((module) => module.OcrToolApp),
  { loading: () => <div className="tool-loading" aria-live="polite">Loading local OCR…</div> },
);
const RedactionToolApp = dynamic(
  () => import("../components/redaction-tool-app").then((module) => module.RedactionToolApp),
  { loading: () => <div className="tool-loading" aria-live="polite">Loading the local redaction tool…</div> },
);
const FormToolApp = dynamic(
  () => import("../components/form-tool-app").then((module) => module.FormToolApp),
  { loading: () => <div className="tool-loading" aria-live="polite">Loading the local form tool…</div> },
);
const ProtectToolApp = dynamic(
  () => import("../components/protect-tool-app").then((module) => module.ProtectToolApp),
  { loading: () => <div className="tool-loading" aria-live="polite">Loading local password protection…</div> },
);

interface RouteProps {
  params: Promise<{ slug: string }>;
}

const staticPageMetadata: Record<LegalSlug, { title: string; description: string }> = {
  about: {
    title: "About | SnackPDF",
    description: "What SnackPDF is, how its local browser processing and offline application work, and what the independent project does not provide.",
  },
  privacy: {
    title: "Privacy | SnackPDF",
    description: "How SnackPDF handles selected documents, temporary browser memory, application caching and managed hosting requests.",
  },
  terms: {
    title: "Terms | SnackPDF",
    description: "The terms for using SnackPDF, including output checks, document rights, password unlocking and reasonable limits.",
  },
  cookies: {
    title: "Cookies | SnackPDF",
    description: "SnackPDF application cookie use, managed hosting anti-abuse behaviour and the separate offline application cache.",
  },
  "open-source-licences": {
    title: "Source and licences | SnackPDF",
    description: "SnackPDF corresponding source, bundled licence texts, Ghostscript build source and release checksums.",
  },
  "offline-use": {
    title: "Offline use | SnackPDF",
    description: "How to prepare SnackPDF for offline use, what application files are cached and how to save locally created results.",
  },
  "how-snackpdf-is-tested": {
    title: "How SnackPDF is tested | Browser-local PDF processing",
    description: "The reproducible network, storage, offline, determinism, fidelity, browser and accessibility checks behind SnackPDF's local-processing claims.",
  },
  support: {
    title: "Support SnackPDF | Independent PDF tools",
    description: "Learn how optional support helps maintain SnackPDF's free, browser-local PDF tools without subscriptions, advertising or document tracking.",
  },
};

function metadataForRoute(title: string, description: string, pathname: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: pathname },
    openGraph: {
      type: "website",
      siteName: "SnackPDF",
      title,
      description,
      url: pathname,
      images: [],
    },
    twitter: { card: "summary", title, description, images: [] },
  };
}

export function generateStaticParams() {
  return [...TOOLS.map((tool) => ({ slug: tool.slug })), ...LEGAL_SLUGS.map((slug) => ({ slug }))];
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = TOOL_BY_SLUG.get(slug);
  if (tool) {
    return metadataForRoute(tool.seoTitle, tool.seoDescription, `/${slug}`);
  }
  if (isLegalSlug(slug)) {
    const page = staticPageMetadata[slug];
    return metadataForRoute(page.title, page.description, `/${slug}`);
  }
  return {};
}

export default async function SlugPage({ params }: RouteProps) {
  const { slug } = await params;
  const tool = TOOL_BY_SLUG.get(slug);
  if (tool) {
    const content = TOOL_CONTENT[slug];
    if (!content) throw new Error(`Tool support content is missing for ${slug}.`);
    return (
      <SiteFrame>
        <main id="main-content" className="tool-main">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <ol>
              <li><a href="/">SnackPDF</a></li>
              <li aria-current="page">{tool.title}</li>
            </ol>
          </nav>
          <h1>{tool.title}</h1>
          <p className="tool-description">{tool.detail}</p>
          <p className="at-a-glance"><strong>At a glance:</strong> {tool.atAGlance}</p>
          {tool.warning ? <aside className="tool-warning"><strong>Manual note:</strong> {tool.warning}</aside> : null}
          {tool.special === "ocr" ? <OcrToolApp /> : tool.special === "redact" ? <RedactionToolApp /> : tool.special === "form" ? <FormToolApp /> : tool.special === "protect" ? <ProtectToolApp /> : <ToolApp tool={tool} />}
          <div className="tool-guide">
            {content.sections.map((section) => (
              <section key={section.heading}>
                <h2>{section.heading}</h2>
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.points ? <ul>{section.points.map((point) => <li key={point}>{point}</li>)}</ul> : null}
              </section>
            ))}
            {TOOL_FACTS[slug] ? (
              <section className="tool-facts" aria-labelledby="tool-facts-heading">
                <h2 id="tool-facts-heading">Privacy, cost and compatibility</h2>
                <dl className="workflow-ledger">
                  {TOOL_FACTS[slug]?.map((fact) => <div key={fact.term}><dt>{fact.term}</dt><dd>{fact.detail}</dd></div>)}
                </dl>
              </section>
            ) : null}
            <section className="related-tools" aria-labelledby="related-tools-heading">
              <h2 id="related-tools-heading">Related tools</h2>
              <ul>
                {content.relatedTools.map((related) => (
                  <li key={related.slug}><a href={`/${related.slug}`}>{related.label}</a></li>
                ))}
              </ul>
              <p><a href="/how-snackpdf-is-tested">See how SnackPDF verifies browser-local processing</a> or read the <a href="/guides/verify-local-pdf-processing">practical guide to checking local PDF tools</a>.</p>
            </section>
          </div>
          <BreadcrumbStructuredData label={tool.title} pathname={`/${slug}`} />
        </main>
      </SiteFrame>
    );
  }
  if (isLegalSlug(slug)) {
    const label = slug === "how-snackpdf-is-tested"
      ? "How SnackPDF is tested"
      : slug === "support"
        ? "Support SnackPDF"
        : staticPageMetadata[slug].title.replace(/ \| SnackPDF$/, "");
    return <SiteFrame><LegalPage slug={slug} /><BreadcrumbStructuredData label={label} pathname={`/${slug}`} /></SiteFrame>;
  }
  notFound();
}

function BreadcrumbStructuredData({ label, pathname }: { label: string; pathname: string }) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "SnackPDF", item: "https://www.snackpdf.com/" },
      { "@type": "ListItem", position: 2, name: label, item: `https://www.snackpdf.com${pathname}` },
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />;
}
