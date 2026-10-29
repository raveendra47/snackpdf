// src/engine/errors.ts
var EngineError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "EngineError";
  }
};
var MESSAGES = {
  "invalid-pdf": "This does not appear to be a valid PDF.",
  "password-required": "This PDF needs a password before it can be opened.",
  "wrong-password": "The password was not accepted.",
  "unsupported-pdf": "This PDF uses a feature that could not be processed safely.",
  "out-of-memory": "There is not enough available memory to process this file.",
  cancelled: "The operation was cancelled.",
  "no-output": "The resulting file could not be created.",
  busy: "Another PDF operation is already running in this tab.",
  "invalid-options": "One or more settings are not valid.",
  "engine-failed": "The resulting file could not be created."
};
function publicMessage(code) {
  return MESSAGES[code] ?? MESSAGES["engine-failed"];
}

// src/engine/profiles.ts
var COMPRESSION_PROFILES = {
  light: {
    label: "Light",
    summary: "Prioritises quality with limited image reduction.",
    colourResolution: 220,
    greyResolution: 220,
    monoResolution: 600,
    jpegQuality: 90
  },
  balanced: {
    label: "Balanced",
    summary: "Suitable for ordinary screens and sharing.",
    colourResolution: 150,
    greyResolution: 150,
    monoResolution: 400,
    jpegQuality: 82
  },
  smallest: {
    label: "Smallest",
    summary: "Makes images smaller with a clearer quality trade off.",
    colourResolution: 96,
    greyResolution: 96,
    monoResolution: 300,
    jpegQuality: 65
  }
};

// src/engine/commands.ts
var PDF_OUTPUT_ARGS = [
  "-sDEVICE=pdfwrite",
  "-dCompatibilityLevel=1.7",
  "-dAutoRotatePages=/None",
  "-dCompressFonts=true",
  "-dCompressPages=true",
  "-dSubsetFonts=true",
  "-dEmbedAllFonts=true",
  "-dDetectDuplicateImages=true",
  "-dOmitInfoDate=true",
  "-dOmitID=true",
  "-dOmitXMP=true"
];
var SAFE_ARGS = ["-dSAFER", "-dBATCH", "-dNOPAUSE", "-dNOPROMPT"];
var VALID_RESOLUTIONS = /* @__PURE__ */ new Set([96, 150, 300]);
function assertInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 1e5) {
    throw new EngineError("invalid-options", `${name} is not valid.`);
  }
}
function inputName(index) {
  assertInteger(index + 1, "File number");
  return `input-${String(index + 1).padStart(3, "0")}.pdf`;
}
function pageFileName(page, extension) {
  assertInteger(page, "Page number");
  if (!/^[a-z0-9]+$/.test(extension)) {
    throw new EngineError("invalid-options", publicMessage("invalid-options"));
  }
  return `page-${String(page).padStart(3, "0")}.${extension}`;
}
function sanitiseDownloadBase(filename) {
  const withoutExtension = filename.replace(/\.pdf$/i, "");
  const cleaned = withoutExtension.normalize("NFKC").replace(/[^a-zA-Z0-9._ -]+/g, "-").replace(/[ ._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return cleaned || "document";
}
function parsePageSelection(value, pageCount) {
  assertInteger(pageCount, "Page count");
  const compact = value.replace(/\s+/g, "");
  if (!compact || !/^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/.test(compact)) {
    throw new EngineError(
      "invalid-options",
      "Use page numbers such as 1, 1-4 or 1,3,8."
    );
  }
  const pages = [];
  for (const part of compact.split(",")) {
    if (part.includes("-")) {
      const [start, end] = part.split("-").map(Number);
      if (start > end) {
        throw new EngineError("invalid-options", "Page ranges must go from low to high.");
      }
      for (let page = start; page <= end; page += 1) pages.push(page);
    } else {
      pages.push(Number(part));
    }
  }
  for (const page of pages) {
    if (!Number.isSafeInteger(page) || page < 1 || page > pageCount) {
      throw new EngineError(
        "invalid-options",
        `Choose pages between 1 and ${pageCount}.`
      );
    }
  }
  return pages;
}
function complementPages(removed, pageCount) {
  assertInteger(pageCount, "Page count");
  const set = new Set(removed);
  for (const page of set) {
    if (!Number.isSafeInteger(page) || page < 1 || page > pageCount) {
      throw new EngineError("invalid-options", publicMessage("invalid-options"));
    }
  }
  const kept = Array.from({ length: pageCount }, (_, index) => index + 1).filter(
    (page) => !set.has(page)
  );
  if (kept.length === 0) {
    throw new EngineError("invalid-options", "At least one page must remain.");
  }
  return kept;
}
function permits(inputCount, output) {
  if (!Number.isSafeInteger(inputCount) || inputCount < 1 || inputCount > 50) {
    throw new EngineError("invalid-options", publicMessage("invalid-options"));
  }
  return [
    ...Array.from(
      { length: inputCount },
      (_, index) => `--permit-file-read=${inputName(index)}`
    ),
    `--permit-file-write=${output}`
  ];
}
function inputNames(inputCount) {
  return Array.from({ length: inputCount }, (_, index) => inputName(index));
}
function pdfPlan(inputCount, extraArgs = []) {
  const output = "output.pdf";
  return {
    args: [
      ...SAFE_ARGS,
      ...PDF_OUTPUT_ARGS,
      ...extraArgs,
      ...permits(inputCount, output),
      `-sOutputFile=${output}`,
      ...inputNames(inputCount)
    ],
    outputNames: [output]
  };
}
function compressionArgs(profileName) {
  const profile = COMPRESSION_PROFILES[profileName];
  if (!profile) {
    throw new EngineError("invalid-options", publicMessage("invalid-options"));
  }
  return [
    "-dDownsampleColorImages=true",
    `-dColorImageResolution=${profile.colourResolution}`,
    "-dColorImageDownsampleThreshold=1.5",
    "-dAutoFilterColorImages=false",
    "-dColorImageFilter=/DCTEncode",
    "-dDownsampleGrayImages=true",
    `-dGrayImageResolution=${profile.greyResolution}`,
    "-dGrayImageDownsampleThreshold=1.5",
    "-dAutoFilterGrayImages=false",
    "-dGrayImageFilter=/DCTEncode",
    "-dDownsampleMonoImages=true",
    `-dMonoImageResolution=${profile.monoResolution}`,
    "-dMonoImageDownsampleThreshold=1.5",
    "-dMonoImageFilter=/CCITTFaxEncode",
    "-dPassThroughJPEGImages=false",
    `-dJPEGQ=${profile.jpegQuality}`
  ];
}
function imagePlan(inputCount, extension, resolution) {
  if (inputCount !== 1 || !VALID_RESOLUTIONS.has(resolution)) {
    throw new EngineError("invalid-options", publicMessage("invalid-options"));
  }
  const pattern = `page-%03d.${extension}`;
  const device = extension === "jpg" ? "jpeg" : "png16m";
  const quality = extension === "jpg" ? ["-dJPEGQ=85"] : [];
  return {
    args: [
      ...SAFE_ARGS,
      `-sDEVICE=${device}`,
      `-r${resolution}`,
      "-dTextAlphaBits=4",
      "-dGraphicsAlphaBits=4",
      ...quality,
      ...permits(1, `page-*.${extension}`),
      `-sOutputFile=${pattern}`,
      inputName(0)
    ],
    outputNames: [],
    outputPattern: new RegExp(`^page-\\d{3,}\\.${extension}$`)
  };
}
function buildCommand(tool, inputCount, options = {}) {
  switch (tool) {
    case "compress":
      if (inputCount !== 1) throw new EngineError("invalid-options", publicMessage("invalid-options"));
      return pdfPlan(1, compressionArgs(options.profile ?? "balanced"));
    case "rebuild":
      return pdfPlan(1, [
        "-dDownsampleColorImages=false",
        "-dDownsampleGrayImages=false",
        "-dDownsampleMonoImages=false",
        "-dPassThroughJPEGImages=true"
      ]);
    case "merge":
      if (inputCount < 2) throw new EngineError("invalid-options", "Choose at least two PDFs.");
      return pdfPlan(inputCount, [
        "-dDownsampleColorImages=false",
        "-dDownsampleGrayImages=false",
        "-dDownsampleMonoImages=false",
        "-dPassThroughJPEGImages=true"
      ]);
    case "extract":
    case "remove":
    case "reorder":
      throw new EngineError("invalid-options", "Page selection is executed as a fixed sequence of local engine jobs.");
    case "pdf-to-jpg":
      return imagePlan(inputCount, "jpg", options.resolution ?? 150);
    case "pdf-to-png":
      return imagePlan(inputCount, "png", options.resolution ?? 150);
    case "pdf-to-text": {
      if (inputCount !== 1) throw new EngineError("invalid-options", publicMessage("invalid-options"));
      const output = "output.txt";
      return {
        args: [
          ...SAFE_ARGS,
          "-sDEVICE=txtwrite",
          "-dTextFormat=3",
          ...permits(1, output),
          `-sOutputFile=${output}`,
          inputName(0)
        ],
        outputNames: [output]
      };
    }
    case "unlock": {
      const password = options.password ?? "";
      if (!password || password.length > 1024 || /[\u0000\r\n]/.test(password)) {
        throw new EngineError("invalid-options", "Enter the PDF password.");
      }
      return pdfPlan(1, [
        `-sPDFPassword=${password}`,
        "-dDownsampleColorImages=false",
        "-dDownsampleGrayImages=false",
        "-dDownsampleMonoImages=false",
        "-dPassThroughJPEGImages=true"
      ]);
    }
    case "grayscale":
      return pdfPlan(1, [
        "-sColorConversionStrategy=Gray",
        "-dProcessColorModel=/DeviceGray",
        "-dOverrideICC=true",
        "-dDownsampleColorImages=false",
        "-dDownsampleGrayImages=false",
        "-dDownsampleMonoImages=false"
      ]);
    case "split":
      throw new EngineError("invalid-options", "Split commands are created one page at a time.");
    default:
      throw new EngineError("invalid-options", publicMessage("invalid-options"));
  }
}
function buildSplitCommand(page) {
  assertInteger(page, "Page number");
  const output = pageFileName(page, "pdf");
  return {
    args: [
      ...SAFE_ARGS,
      ...PDF_OUTPUT_ARGS,
      `-dFirstPage=${page}`,
      `-dLastPage=${page}`,
      "-dDownsampleColorImages=false",
      "-dDownsampleGrayImages=false",
      "-dDownsampleMonoImages=false",
      "-dPassThroughJPEGImages=true",
      ...permits(1, output),
      `-sOutputFile=${output}`,
      inputName(0)
    ],
    outputNames: [output]
  };
}
function buildThumbnailCommand() {
  const pattern = "thumb-%03d.png";
  return {
    args: [
      ...SAFE_ARGS,
      "-sDEVICE=png16m",
      "-r30",
      "-dTextAlphaBits=2",
      "-dGraphicsAlphaBits=2",
      ...permits(1, "thumb-*.png"),
      `-sOutputFile=${pattern}`,
      inputName(0)
    ],
    outputNames: [],
    outputPattern: /^thumb-\d{3,}\.png$/
  };
}
function buildCountCommand() {
  return [
    "-q",
    "-dSAFER",
    "-dNODISPLAY",
    `--permit-file-read=${inputName(0)}`,
    "-c",
    `(${inputName(0)}) (r) file runpdfbegin pdfpagecount dup = 1 1 3 -1 roll { pdfgetpage /MediaBox get == } for quit`
  ];
}
export {
  buildCommand,
  buildCountCommand,
  buildSplitCommand,
  buildThumbnailCommand,
  complementPages,
  inputName,
  pageFileName,
  parsePageSelection,
  sanitiseDownloadBase
};
