export interface ToolSupportSection {
  heading: string;
  paragraphs: string[];
  points?: string[];
}

export interface ToolPageContent {
  sections: ToolSupportSection[];
  relatedTools: Array<{ slug: string; label: string }>;
}

export interface ToolFact {
  term: string;
  detail: string;
}

export const TOOL_FACTS: Partial<Record<string, ToolFact[]>> = {
  "compress-pdf": [
    { term: "Uploaded?", detail: "No. The selected PDF is read and compressed in this browser tab." },
    { term: "Cost and account", detail: "Free to use. No account or paid credits are required." },
    { term: "Watermark", detail: "None is added to the compressed PDF." },
    { term: "Offline", detail: "Yes, after SnackPDF reports that the complete application is ready for offline use." },
    { term: "Mobile", detail: "Yes in supported mobile browsers, although large or image-heavy PDFs may exceed device memory." },
    { term: "Important limit", detail: "Compression rewrites the PDF; size may not fall, and forms, links, bookmarks, comments or metadata can change." },
  ],
  "merge-pdf": [
    { term: "Uploaded?", detail: "No. All selected PDFs are combined locally in the current browser tab." },
    { term: "Cost and account", detail: "Free to use, with no account or paid credits." },
    { term: "Watermark", detail: "None is added to the merged file." },
    { term: "Offline", detail: "Yes, once the full application has finished preparing for offline use." },
    { term: "Mobile", detail: "Yes, but merging many or large confidential files can exceed a phone's available memory." },
    { term: "Important limit", detail: "The result is a rewrite, so bookmarks, forms, annotations, links, metadata and other structures may change." },
  ],
  "split-pdf": [
    { term: "Uploaded?", detail: "No. The source PDF is split locally on this device." },
    { term: "Cost and account", detail: "Free to use. No sign-in or paid credits are required." },
    { term: "Watermark", detail: "None is added to the page PDFs." },
    { term: "Offline", detail: "Yes, after the offline-ready status appears." },
    { term: "Mobile", detail: "Yes in supported mobile browsers, subject to browser memory and download handling." },
    { term: "Important limit", detail: "Every page is rewritten as a fresh PDF, so document-level and interactive features may be lost." },
  ],
  "pdf-to-jpg": [
    { term: "Uploaded?", detail: "No. Pages are rendered to JPG images locally in this browser." },
    { term: "Cost and account", detail: "Free to use without an account or paid credits." },
    { term: "Watermark", detail: "None is added to the JPG files." },
    { term: "Offline", detail: "Yes, after the application and local processing engine are ready." },
    { term: "Mobile", detail: "Yes, but high DPI or many pages can use substantial memory and create many downloads." },
    { term: "Important limit", detail: "JPG is lossy and contains no selectable text, links, forms or vector objects from the PDF." },
  ],
  "grayscale-pdf": [
    { term: "Uploaded?", detail: "No. Colour conversion happens locally in the current tab." },
    { term: "Cost and account", detail: "Free to use with no account or paid credits." },
    { term: "Watermark", detail: "None is added to the grayscale copy." },
    { term: "Offline", detail: "Yes, after SnackPDF has cached the complete application." },
    { term: "Mobile", detail: "Yes in supported mobile browsers, within the device's practical memory limit." },
    { term: "Important limit", detail: "The output is a fresh PDF; colour meaning and forms, links, bookmarks, annotations or metadata may change." },
  ],
  "remove-pages": [
    { term: "Uploaded?", detail: "No. Page previews and the new PDF are created locally on your device." },
    { term: "Cost and account", detail: "Free to use. No account or paid credits are needed." },
    { term: "Watermark", detail: "None is added to the saved PDF." },
    { term: "Offline", detail: "Yes, once offline preparation is complete." },
    { term: "Mobile", detail: "Yes. Preview controls work with touch, but large documents can exceed mobile memory." },
    { term: "Important limit", detail: "At least one page must remain. Page removal is not redaction, and document-wide structures may change." },
  ],
  "unlock-pdf": [
    { term: "Uploaded?", detail: "No. The PDF and known password stay in this tab during processing." },
    { term: "Cost and account", detail: "Free to use without an account or paid credits." },
    { term: "Watermark", detail: "None is added to the unlocked copy." },
    { term: "Offline", detail: "Yes, after the complete application is ready for offline use." },
    { term: "Mobile", detail: "Yes in supported mobile browsers, subject to device memory." },
    { term: "Important limit", detail: "You must know the password and be authorised to open the file; SnackPDF does not recover or bypass passwords." },
  ],
  "protect-pdf": [
    { term: "Uploaded?", detail: "No. AES-256 encryption happens locally in this browser tab." },
    { term: "Cost and account", detail: "Free to use without an account or paid credits." },
    { term: "Watermark", detail: "None is added to the protected PDF." },
    { term: "Offline", detail: "Yes, after the application is ready for offline use and the page is served from a secure context." },
    { term: "Mobile", detail: "Supported mobile browsers can protect PDFs, subject to device memory and reader support." },
    { term: "Important limit", detail: "AES-256 requires Web Crypto in a secure HTTPS context. Reader permissions are advisory, and encryption does not remove or redact content." },
  ],
  "ocr-pdf": [
    { term: "Uploaded?", detail: "No. PDF pages are rendered and recognised in this browser tab." },
    { term: "Cost and account", detail: "Free to use without an account or paid credits." },
    { term: "Watermark", detail: "None is added to the extracted text." },
    { term: "Offline", detail: "Yes, after the local OCR assets and application are ready for offline use." },
    { term: "Mobile", detail: "Supported mobile browsers can run OCR, but scans with many pages use substantial memory and time." },
    { term: "Important limit", detail: "English OCR data is bundled. Recognition can misread unclear, handwritten, rotated or unusual text; confidence is an estimate, not proof." },
  ],
  "redact-pdf": [
    { term: "Uploaded?", detail: "No. Redaction rendering and PDF rebuilding happen in this browser tab." },
    { term: "Cost and account", detail: "Free to use without an account or paid credits." },
    { term: "Watermark", detail: "None is added to the redacted PDF." },
    { term: "Offline", detail: "Yes, after the complete application is ready for offline use." },
    { term: "Mobile", detail: "Supported touch browsers can draw boxes, although careful review is easier on a larger screen." },
    { term: "Important limit", detail: "Affected pages are rasterised and lose selectable text, links and vector structure. Check every page before sharing." },
  ],
  "fill-pdf-form": [
    { term: "Uploaded?", detail: "No. Form detection, field editing and PDF saving happen locally in this browser." },
    { term: "Cost and account", detail: "Free to use without an account or paid credits." },
    { term: "Watermark", detail: "None is added to the completed form." },
    { term: "Offline", detail: "Yes, after the local form editor and application are ready for offline use." },
    { term: "Mobile", detail: "Supported mobile browsers can fill fields; placed annotations are easier to position on a larger screen." },
    { term: "Important limit", detail: "Existing AcroForm fields are filled directly. A form without fields uses placed annotations, and complex XFA forms may not be supported." },
  ],
};

export const TOOL_CONTENT: Record<string, ToolPageContent> = {
  "compress-pdf": {
    sections: [
      {
        heading: "Choose the compression trade-off",
        paragraphs: [
          "Light prioritises image quality, Balanced is intended for ordinary screens and sharing, and Smallest applies the strongest image reduction. The three profiles are fixed, so the same profile and input produce a repeatable result.",
        ],
        points: [
          "Light: colour and grayscale images up to 220 DPI, with higher JPEG quality.",
          "Balanced: colour and grayscale images up to 150 DPI.",
          "Smallest: colour and grayscale images up to 96 DPI, with the clearest quality trade-off.",
        ],
      },
      {
        heading: "What the result can change",
        paragraphs: [
          "Compression writes a fresh PDF. Images may be resampled and re-encoded, and comments, forms, bookmarks, links, metadata or other document structures may change. A short or already well-compressed PDF can stay similar in size or even become larger.",
          "Keep the original and check the saved copy at the size and zoom level that matter for its intended use.",
        ],
      },
    ],
    relatedTools: [
      { slug: "rebuild-pdf", label: "Rebuild a PDF without image downsampling" },
      { slug: "grayscale-pdf", label: "Convert PDF colours to grayscale" },
    ],
  },
  "rebuild-pdf": {
    sections: [
      {
        heading: "What rebuild means",
        paragraphs: [
          "Rebuild reads an existing PDF and writes a new PDF from the content it can interpret. It can be useful when a file opens but behaves awkwardly in another viewer or workflow.",
          "This is not a repair or recovery service. It cannot promise to recover unreadable, missing or corrupted content, and a file the processor cannot open will still fail.",
        ],
      },
      {
        heading: "Expect a structurally different file",
        paragraphs: [
          "The fresh copy is intended for ordinary viewing. Interactive forms, annotations, bookmarks, links, embedded files, metadata and other non-visible structures may be altered or omitted even when the pages look the same.",
          "Keep the original and check both the visible pages and any features you rely on before replacing another copy.",
        ],
      },
    ],
    relatedTools: [
      { slug: "compress-pdf", label: "Compress a PDF with fixed profiles" },
      { slug: "unlock-pdf", label: "Unlock a PDF when you know its password" },
    ],
  },
  "grayscale-pdf": {
    sections: [
      {
        heading: "What the colour test verifies",
        paragraphs: [
          "SnackPDF's release fixture contains coloured pages. The automated fidelity check converts that fixture, renders the result and verifies that each sampled pixel has effectively equal red, green and blue values.",
          "That test supports the grayscale claim. It does not prove that every PDF structure, colour profile, form or interactive feature remains unchanged.",
        ],
      },
      {
        heading: "Check meaning as well as appearance",
        paragraphs: [
          "Grayscale can make charts, highlights or status colours harder to distinguish. The output is a fresh PDF, so inspect pages where colour carries meaning and keep the original until the new copy has been checked.",
        ],
      },
    ],
    relatedTools: [
      { slug: "compress-pdf", label: "Compress a PDF with fixed profiles" },
      { slug: "rebuild-pdf", label: "Create a fresh PDF copy" },
    ],
  },
  "merge-pdf": {
    sections: [
      {
        heading: "The file list controls the page order",
        paragraphs: [
          "Choose between two and 50 PDFs. Use the move buttons to put the files in the required order; every page from the first listed file is written before every page from the second, and so on.",
          "The selected files are read together in this browser tab. SnackPDF can stop before processing when their estimated memory use is unsafe for the device.",
        ],
      },
      {
        heading: "The combined file is a rewrite",
        paragraphs: [
          "Merge creates one new PDF rather than attaching the originals unchanged. Document-level bookmarks, forms, annotations, links, metadata and other structures may change or disappear, so check the result as well as its page order.",
        ],
      },
    ],
    relatedTools: [
      { slug: "split-pdf", label: "Split a PDF into individual pages" },
      { slug: "reorder-pages", label: "Reorder pages within one PDF" },
      { slug: "extract-pages", label: "Extract selected PDF pages" },
    ],
  },
  "split-pdf": {
    sections: [
      {
        heading: "One output file for every page",
        paragraphs: [
          "Split processes the complete document and produces page-001.pdf, page-002.pdf and so on. Each output contains exactly one page, and the original PDF remains unchanged.",
          "If you need one PDF containing only a chosen range or a custom order, use Extract pages instead. Split does not ask for a range because its job is deliberately different.",
        ],
      },
      {
        heading: "Each page becomes a fresh PDF",
        paragraphs: [
          "Page appearance is carried into new single-page files, but document-wide bookmarks, forms, links, comments, metadata and other interactive structures may change or disappear. Check any page that relies on those features.",
        ],
      },
    ],
    relatedTools: [
      { slug: "extract-pages", label: "Extract selected pages into one PDF" },
      { slug: "merge-pdf", label: "Merge PDF files in a chosen order" },
      { slug: "remove-pages", label: "Remove unwanted PDF pages" },
    ],
  },
  "extract-pages": {
    sections: [
      {
        heading: "Choose ranges and control the final order",
        paragraphs: [
          "Enter a page such as 1, a range such as 1-4, or a comma-separated combination such as 1-3,8,5. SnackPDF shows the interpreted sequence before processing.",
          "The order you enter is preserved, and repeated page numbers are kept. For example, 3,1,3 creates a three-page PDF in exactly that sequence.",
        ],
      },
      {
        heading: "Extract creates one PDF, not one file per page",
        paragraphs: [
          "All selected pages are combined into one new PDF. Use Split PDF when the required result is a separate PDF for every page in the source.",
          "Because the selected pages are rewritten, document-wide links, bookmarks, forms, comments and metadata may change.",
        ],
      },
    ],
    relatedTools: [
      { slug: "split-pdf", label: "Split every page into a separate PDF" },
      { slug: "remove-pages", label: "Remove selected pages from a PDF" },
      { slug: "reorder-pages", label: "Reorder all pages in a PDF" },
    ],
  },
  "remove-pages": {
    sections: [
      {
        heading: "Choose pages from local previews",
        paragraphs: [
          "SnackPDF creates small page previews on this device. Select a preview to mark that page for removal; the controls work as ordinary buttons with a keyboard as well as by touch or mouse.",
          "At least one page must remain. Retained pages stay in their original order in the new PDF.",
        ],
      },
      {
        heading: "Removing a page is not redaction",
        paragraphs: [
          "This tool removes complete pages. It does not prove that similar text, images, attachments or metadata are absent elsewhere, so do not use page removal as a substitute for a reviewed redaction process.",
          "The retained pages are rewritten and document-wide features may change. Keep the original until the output has been checked.",
        ],
      },
    ],
    relatedTools: [
      { slug: "extract-pages", label: "Extract selected pages into one PDF" },
      { slug: "reorder-pages", label: "Reorder PDF pages" },
      { slug: "split-pdf", label: "Split every page into its own PDF" },
    ],
  },
  "reorder-pages": {
    sections: [
      {
        heading: "Arrange pages without losing the original numbers",
        paragraphs: [
          "SnackPDF generates page previews on this device. Drag a preview or use its Move left and Move right buttons; each card continues to show the page number from the original PDF.",
          "The keyboard controls keep focus on the moved button and announce the new position. Every source page is retained exactly once.",
        ],
      },
      {
        heading: "The new order is written into a fresh PDF",
        paragraphs: [
          "Reordering does not edit the original file. It builds a new PDF in the displayed sequence, which means document-wide bookmarks, links, forms, comments and metadata may change or disappear.",
        ],
      },
    ],
    relatedTools: [
      { slug: "remove-pages", label: "Remove selected PDF pages" },
      { slug: "extract-pages", label: "Extract pages in a custom order" },
      { slug: "merge-pdf", label: "Merge several PDF files" },
    ],
  },
  "pdf-to-jpg": {
    sections: [
      {
        heading: "Choose resolution for the intended use",
        paragraphs: [
          "Screen renders at 96 DPI, Standard at 150 DPI and Print at 300 DPI. A higher setting creates more pixels and usually larger files; 300 DPI also uses substantially more memory and may be refused on a constrained device.",
          "Every PDF page becomes a separate page-001.jpg, page-002.jpg and so on.",
        ],
      },
      {
        heading: "JPEG is a rendered, lossy image",
        paragraphs: [
          "The result no longer contains selectable PDF text, links, forms or vector objects. JPEG compression can introduce visible artefacts around text and lines, so PNG can be a better fit for diagrams or interface screenshots.",
        ],
      },
    ],
    relatedTools: [
      { slug: "pdf-to-png", label: "Convert PDF pages to PNG images" },
      { slug: "pdf-to-text", label: "Extract stored text from a PDF" },
    ],
  },
  "pdf-to-png": {
    sections: [
      {
        heading: "Each page is rendered at a fixed resolution",
        paragraphs: [
          "Screen uses 96 DPI, Standard uses 150 DPI and Print uses 300 DPI. Higher resolutions create more pixels and require more memory; SnackPDF stops before processing if its estimate is unsafe for the browser.",
          "The output names follow the original page order: page-001.png, page-002.png and so on.",
        ],
      },
      {
        heading: "PNG preserves rendered pixels, not PDF structure",
        paragraphs: [
          "PNG uses lossless image encoding, which is useful for line art, diagrams and text-heavy pages. The conversion still rasterises each page, so selectable text, links, forms and vector objects are not present in the images.",
        ],
      },
    ],
    relatedTools: [
      { slug: "pdf-to-jpg", label: "Convert PDF pages to JPEG images" },
      { slug: "pdf-to-text", label: "Extract stored text from a PDF" },
    ],
  },
  "pdf-to-text": {
    sections: [
      {
        heading: "Stored text only",
        paragraphs: [
          "This tool reads text objects that already exist inside the PDF. A scanned page can look like text to a person while containing only an image; because SnackPDF does not perform OCR, that page can produce an empty result.",
          "The release suite includes an image-only fixture and verifies that it truthfully produces no stored text.",
        ],
      },
      {
        heading: "Expect plain text rather than page layout",
        paragraphs: [
          "The output is one UTF-8 text file. Columns, tables, reading order, spacing and line breaks may differ from the visible page, while images and drawings are omitted. Check the result before using it in another workflow.",
        ],
      },
    ],
    relatedTools: [
      { slug: "pdf-to-jpg", label: "Render scanned PDF pages as JPEG images" },
      { slug: "pdf-to-png", label: "Render scanned PDF pages as PNG images" },
    ],
  },
  "unlock-pdf": {
    sections: [
      {
        heading: "You must know the password",
        paragraphs: [
          "SnackPDF passes the password you enter to the local processor so it can open the document and write a new copy without password protection. It does not guess, crack, bypass or recover an unknown password.",
          "Use this only for a document you are authorised to open. The original protected PDF remains unchanged.",
        ],
      },
      {
        heading: "The password is limited to the current operation",
        paragraphs: [
          "The password is held in this browser tab while the file is processed and is cleared after completion. It is not placed in the URL, application cache, browser storage or a request to SnackPDF.",
          "Unlocking writes a fresh PDF, so forms, links, bookmarks, comments, metadata and other structures may change. Check the result before relying on it.",
        ],
      },
    ],
    relatedTools: [
      { slug: "rebuild-pdf", label: "Rebuild a PDF you can already open" },
      { slug: "compress-pdf", label: "Compress an unlocked PDF" },
    ],
  },
  "protect-pdf": {
    sections: [
      {
        heading: "Use a real open password for confidentiality",
        paragraphs: [
          "SnackPDF writes PDF 2.0 AES-256 encryption locally in this browser. The open password is required by a reader before it can display the file; an optional owner password manages the permissions you choose. Passwords are cleared from the page after the operation.",
          "Permissions are advisory. Conforming readers may honour the printing, copying, editing, annotation, form, accessibility and assembly choices, but nothing cryptographic prevents a determined tool from ignoring them.",
        ],
      },
      {
        heading: "Encryption is not redaction",
        paragraphs: [
          "Password protection does not remove anything. Anyone who can open the file can see all of its content, including text or images that were only covered by a rectangle. If content must be removed from the saved file, use Redact PDF content and review the result separately.",
          "Open the downloaded result in another PDF reader and test the password before sending it. AES-256 needs a secure HTTPS context; SnackPDF throws an error instead of silently falling back to the weak legacy RC4 algorithm.",
        ],
      },
    ],
    relatedTools: [
      { slug: "unlock-pdf", label: "Unlock a PDF when you know its password" },
      { slug: "redact-pdf", label: "Remove selected PDF content" },
      { slug: "fill-pdf-form", label: "Fill existing PDF form fields" },
    ],
  },
  "ocr-pdf": {
    sections: [
      {
        heading: "Extract text from a scan on this device",
        paragraphs: [
          "OCR is different from the existing Extract text tool. Extract text reads characters already stored in a PDF; this tool renders each page locally and recognises printed text from the page image. The original PDF remains unchanged, and the result is shown one page at a time so you can check it before copying or downloading.",
          "The English recognition data, PDF renderer, and OCR worker are served from SnackPDF's own origin and cached with the rest of the application. Once the offline-ready message appears, OCR does not need a network connection or a document-processing service.",
        ],
      },
      {
        heading: "Review confidence and the plain-text result",
        paragraphs: [
          "Each page includes the recognition confidence reported by Tesseract.js. It is a useful prompt for review, not a guarantee of correctness. Expect mistakes with handwriting, unusual typefaces, skewed pages, tables, columns, faded scans, accents and page images with low contrast. Compare names, numbers, dates and amounts against the scan before reusing them.",
          "Copy the full document, copy an individual page or download a UTF-8 .txt file. Page layout, images, tables and formatting are not preserved in plain text.",
        ],
      },
    ],
    relatedTools: [
      { slug: "pdf-to-text", label: "Extract text already stored in a PDF" },
      { slug: "pdf-to-png", label: "Render PDF pages as PNG images" },
      { slug: "redact-pdf", label: "Redact selected PDF content" },
    ],
  },
  "redact-pdf": {
    sections: [
      {
        heading: "Draw boxes over content to remove",
        paragraphs: [
          "Choose a PDF and SnackPDF renders its pages locally for review. Select the page you want to inspect, draw one or more solid boxes over names, addresses, numbers or other content, or add a box with the position controls. Remove and recreate a box to correct its placement before applying redactions. Boxes are page coordinates, so check the whole page at a readable zoom and include every copy of the sensitive content.",
          "This is a destructive operation on the saved copy. Keep the original file separate until you have reviewed the result and no longer need the unredacted version in the workflow.",
        ],
      },
      {
        heading: "Why redacted pages lose their text layer",
        paragraphs: [
          "When you apply redactions, every affected page is rendered to a high-resolution image, the boxes are painted solid, and that image replaces the original page. The original text and vector instructions are not retained behind the box. Unaffected pages are copied without rasterisation and keep their text layer.",
          "Affected pages are no longer searchable or selectable. Test the saved PDF by selecting text, searching for the removed phrase and extracting text with another PDF tool. A black rectangle drawn over a live text layer is not a redaction; this tool deliberately accepts the text-layer trade-off so the removed page content cannot be recovered from the page structure.",
        ],
      },
    ],
    relatedTools: [
      { slug: "remove-pages", label: "Remove complete PDF pages" },
      { slug: "ocr-pdf", label: "Extract text from a scanned PDF" },
      { slug: "rebuild-pdf", label: "Create a fresh PDF copy" },
    ],
  },
  "fill-pdf-form": {
    sections: [
      {
        heading: "Fill existing AcroForm fields",
        paragraphs: [
          "Choose a PDF and SnackPDF inspects its interactive AcroForm fields locally. Text fields, checkboxes, radio buttons, dropdowns and simple choice fields appear as editable controls with their field names. Enter or select the values you need, then save a new PDF. The original form stays unchanged in your device's file picker and is never uploaded.",
          "Existing AcroForm fields remain live and editable in the saved PDF; this tool does not flatten them. If a PDF has no usable fields, the fallback places static text, checkbox or date marks instead.",
          "After saving, reopen the downloaded file in a PDF reader and check the values, page appearance and any signatures or workflow features that matter. PDF forms can contain features outside the simple field types supported here, including complex XFA forms and scripts.",
        ],
      },
      {
        heading: "Add annotations when a PDF has no fields",
        paragraphs: [
          "A PDF without AcroForm fields can still be completed with placed text, checkboxes and dates. Choose an annotation type, enter its value, click the page position or use the position controls. Remove and recreate a misplaced annotation before saving. These are visible PDF annotations rather than new interactive form fields, so they are useful for a completed copy but may not behave like a government form's original controls.",
          "The editor writes a fresh PDF with pdf-lib. It does not send field values, annotation text or document bytes to a server. Keep the original and confirm the saved result in a third-party reader before submitting it.",
        ],
      },
    ],
    relatedTools: [
      { slug: "rebuild-pdf", label: "Create a fresh PDF copy" },
      { slug: "merge-pdf", label: "Merge completed PDF files" },
      { slug: "ocr-pdf", label: "Extract text from a scanned form" },
    ],
  },
};
