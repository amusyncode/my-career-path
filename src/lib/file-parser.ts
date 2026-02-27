const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error("파일 크기는 10MB를 초과할 수 없습니다.");
  }

  switch (mimeType) {
    case "application/pdf": {
      // pdf-parse v2의 pdfjs-dist ESM 호환 문제로 동적 import 사용
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      if (!result.text.trim()) {
        throw new Error("PDF에서 텍스트를 추출할 수 없습니다. 이미지 기반 PDF는 지원하지 않습니다.");
      }
      return result.text;
    }

    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      if (!result.value.trim()) {
        throw new Error("DOCX에서 텍스트를 추출할 수 없습니다.");
      }
      return result.value;
    }

    case "text/plain": {
      const text = buffer.toString("utf-8");
      if (!text.trim()) {
        throw new Error("파일이 비어있습니다.");
      }
      return text;
    }

    default:
      throw new Error(
        `지원하지 않는 파일 형식입니다: ${mimeType}. PDF, DOCX, TXT 파일만 지원합니다.`
      );
  }
}
