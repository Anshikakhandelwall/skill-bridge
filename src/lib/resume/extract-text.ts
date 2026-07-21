import { PDFParse } from "pdf-parse";

export class ResumeExtractionError extends Error {
  code: "invalid_pdf" | "empty_text";

  constructor(code: "invalid_pdf" | "empty_text", message: string) {
    super(message);
    this.code = code;
    this.name = "ResumeExtractionError";
  }
}

/**
 * Extracts plain text from a PDF file buffer.
 * Throws a ResumeExtractionError for corrupt PDFs or PDFs with no
 * extractable text (e.g. scanned/image-only documents).
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  let parser: PDFParse;
  try {
    parser = new PDFParse({ data: buffer });
  } catch {
    throw new ResumeExtractionError("invalid_pdf", "The uploaded file could not be read as a PDF.");
  }

  try {
    const result = await parser.getText();
    const text = result.text?.trim() ?? "";
    if (!text) {
      throw new ResumeExtractionError(
        "empty_text",
        "No readable text was found in this PDF. It may be a scanned image without selectable text.",
      );
    }
    return text;
  } catch (error) {
    if (error instanceof ResumeExtractionError) throw error;
    throw new ResumeExtractionError("invalid_pdf", "This file is not a valid or readable PDF.");
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
