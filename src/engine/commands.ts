import { EngineError, publicMessage } from "./errors";
import { COMPRESSION_PROFILES } from "./profiles";
import type {
  CommandPlan,
  CompressionProfile,
  EngineTool,
  ExecuteOptions,
  ImageResolution,
} from "./types";

const PDF_OUTPUT_ARGS = [
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
  "-dOmitXMP=true",
];

const SAFE_ARGS = ["-dSAFER", "-dBATCH", "-dNOPAUSE", "-dNOPROMPT"];
const VALID_RESOLUTIONS = new Set<ImageResolution>([96, 150, 300]);

function assertInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > 100000) {
    throw new EngineError("invalid-options", `${name} is not valid.`);
  }
}

export function inputName(index: number): string {
  assertInteger(index + 1, "File number");
  return `input-${String(index + 1).padStart(3, "0")}.pdf`;
}

export function pageFileName(page: number, extension: string): string {
  assertInteger(page, "Page number");
  if (!/^[a-z0-9]+$/.test(extension)) {
    throw new EngineError("invalid-options", publicMessage("invalid-options"));
  }
  return `page-${String(page).padStart(3, "0")}.${extension}`;
}

export function sanitiseDownloadBase(filename: string): string {
  const withoutExtension = filename.replace(/\.pdf$/i, "");
  const cleaned = withoutExtension
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._ -]+/g, "-")
    .replace(/[ ._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return cleaned || "document";
}

export function parsePageSelection(value: string, pageCount: number): number[] {
  assertInteger(pageCount, "Page count");
  const compact = value.replace(/\s+/g, "");
  if (!compact || !/^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/.test(compact)) {
    throw new EngineError(
      "invalid-options",
      "Use page numbers such as 1, 1-4 or 1,3,8.",
    );
  }
  const pages: number[] = [];
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
        `Choose pages between 1 and ${pageCount}.`,
      );
    }
  }
  return pages;
}

export function complementPages(removed: number[], pageCount: number): number[] {
  assertInteger(pageCount, "Page count");
  const set = new Set(removed);
  for (const page of set) {
    if (!Number.isSafeInteger(page) || page < 1 || page > pageCount) {
      throw new EngineError("invalid-options", publicMessage("invalid-options"));
    }
  }
  const kept = Array.from({ length: pageCount }, (_, index) => index + 1).filter(
    (page) => !set.has(page),
  );
  if (kept.length === 0) {
    throw new EngineError("invalid-options", "At least one page must remain.");
  }
  return kept;
}

function permits(inputCount: number, output: string): string[] {
  if (!Number.isSafeInteger(inputCount) || inputCount < 1 || inputCount > 50) {
    throw new EngineError("invalid-options", publicMessage("invalid-options"));
  }
  return [
    ...Array.from({ length: inputCount }, (_, index) =>
      `--permit-file-read=${inputName(index)}`,
    ),
    `--permit-file-write=${output}`,
  ];
}

function inputNames(inputCount: number): string[] {
  return Array.from({ length: inputCount }, (_, index) => inputName(index));
}

function pdfPlan(
  inputCount: number,
  extraArgs: string[] = [],
): CommandPlan {
  const output = "output.pdf";
  return {
    args: [
      ...SAFE_ARGS,
      ...PDF_OUTPUT_ARGS,
      ...extraArgs,
      ...permits(inputCount, output),
      `-sOutputFile=${output}`,
      ...inputNames(inputCount),
    ],
    outputNames: [output],
  };
}

function compressionArgs(profileName: CompressionProfile): string[] {
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
    `-dJPEGQ=${profile.jpegQuality}`,
  ];
}

function imagePlan(
  inputCount: number,
  extension: "jpg" | "png",
  resolution: ImageResolution,
): CommandPlan {
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
      inputName(0),
    ],
    outputNames: [],
    outputPattern: new RegExp(`^page-\\d{3,}\\.${extension}$`),
  };
}

export function buildCommand(
  tool: EngineTool,
  inputCount: number,
  options: ExecuteOptions = {},
): CommandPlan {
  switch (tool) {
    case "compress":
      if (inputCount !== 1) throw new EngineError("invalid-options", publicMessage("invalid-options"));
      return pdfPlan(1, compressionArgs(options.profile ?? "balanced"));
    case "rebuild":
      return pdfPlan(1, [
        "-dDownsampleColorImages=false",
        "-dDownsampleGrayImages=false",
        "-dDownsampleMonoImages=false",
        "-dPassThroughJPEGImages=true",
      ]);
    case "merge":
      if (inputCount < 2) throw new EngineError("invalid-options", "Choose at least two PDFs.");
      return pdfPlan(inputCount, [
        "-dDownsampleColorImages=false",
        "-dDownsampleGrayImages=false",
        "-dDownsampleMonoImages=false",
        "-dPassThroughJPEGImages=true",
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
          inputName(0),
        ],
        outputNames: [output],
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
        "-dPassThroughJPEGImages=true",
      ]);
    }
    case "grayscale":
      return pdfPlan(1, [
        "-sColorConversionStrategy=Gray",
        "-dProcessColorModel=/DeviceGray",
        "-dOverrideICC=true",
        "-dDownsampleColorImages=false",
        "-dDownsampleGrayImages=false",
        "-dDownsampleMonoImages=false",
      ]);
    case "split":
      throw new EngineError("invalid-options", "Split commands are created one page at a time.");
    default:
      throw new EngineError("invalid-options", publicMessage("invalid-options"));
  }
}

export function buildSplitCommand(page: number): CommandPlan {
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
      inputName(0),
    ],
    outputNames: [output],
  };
}

export function buildThumbnailCommand(): CommandPlan {
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
      inputName(0),
    ],
    outputNames: [],
    outputPattern: /^thumb-\d{3,}\.png$/,
  };
}

export function buildCountCommand(): string[] {
  return [
    "-q",
    "-dSAFER",
    "-dNODISPLAY",
    `--permit-file-read=${inputName(0)}`,
    "-c",
    `(${inputName(0)}) (r) file runpdfbegin pdfpagecount dup = 1 1 3 -1 roll { pdfgetpage /MediaBox get == } for quit`,
  ];
}
