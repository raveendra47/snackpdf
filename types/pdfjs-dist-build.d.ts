declare module "pdfjs-dist/build/pdf.min.mjs" {
  interface PDFPageProxy {
    getViewport(options: { scale: number }): { width: number; height: number };
    render(options: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }): { promise: Promise<void> };
    cleanup(): void;
  }

  interface PDFDocumentProxy {
    numPages: number;
    getPage(page: number): Promise<PDFPageProxy>;
    destroy(): Promise<void>;
  }

  export const GlobalWorkerOptions: { workerSrc: string };
  export function getDocument(options: unknown): { promise: Promise<PDFDocumentProxy> };
}
