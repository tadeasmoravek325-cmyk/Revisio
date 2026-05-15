const textDecoder = new TextDecoder("utf-8");
const latinDecoder = new TextDecoder("latin1");
const PDFJS_VERSION = "4.10.38";
const PDFJS_MODULE_URL = `https://esm.sh/pdfjs-dist@${PDFJS_VERSION}/build/pdf.mjs`;
const PDFJS_WORKER_URL = `https://esm.sh/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.mjs`;

function getExtension(fileName: string) {
  const match = fileName.toLocaleLowerCase().match(/\.[^.]+$/);
  return match?.[0] ?? "";
}

function readUInt16LE(view: DataView, offset: number) {
  return view.getUint16(offset, true);
}

function readUInt32LE(view: DataView, offset: number) {
  return view.getUint32(offset, true);
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

async function inflateData(data: Uint8Array, format: "deflate" | "deflate-raw") {
  if (!("DecompressionStream" in globalThis)) {
    throw new Error("This browser cannot decompress DOCX/PDF content yet.");
  }

  const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflateRaw(data: Uint8Array) {
  return inflateData(data, "deflate-raw");
}

async function inflateZlib(data: Uint8Array) {
  return inflateData(data, "deflate");
}

async function readZipEntry(fileData: Uint8Array, entryName: string) {
  const view = new DataView(fileData.buffer, fileData.byteOffset, fileData.byteLength);
  const maxSearch = Math.max(0, fileData.length - 66000);
  let eocdOffset = -1;

  for (let offset = fileData.length - 22; offset >= maxSearch; offset -= 1) {
    if (readUInt32LE(view, offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error("This DOCX file could not be read.");
  }

  const centralDirectorySize = readUInt32LE(view, eocdOffset + 12);
  const centralDirectoryOffset = readUInt32LE(view, eocdOffset + 16);
  let offset = centralDirectoryOffset;
  const end = centralDirectoryOffset + centralDirectorySize;

  while (offset < end) {
    if (readUInt32LE(view, offset) !== 0x02014b50) {
      break;
    }

    const method = readUInt16LE(view, offset + 10);
    const compressedSize = readUInt32LE(view, offset + 20);
    const fileNameLength = readUInt16LE(view, offset + 28);
    const extraLength = readUInt16LE(view, offset + 30);
    const commentLength = readUInt16LE(view, offset + 32);
    const localHeaderOffset = readUInt32LE(view, offset + 42);
    const name = textDecoder.decode(fileData.slice(offset + 46, offset + 46 + fileNameLength));

    if (name === entryName) {
      const localNameLength = readUInt16LE(view, localHeaderOffset + 26);
      const localExtraLength = readUInt16LE(view, localHeaderOffset + 28);
      const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = fileData.slice(dataOffset, dataOffset + compressedSize);

      if (method === 0) {
        return compressed;
      }

      if (method === 8) {
        return inflateRaw(compressed);
      }

      throw new Error("This DOCX compression method is not supported.");
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  throw new Error("This DOCX does not contain readable document text.");
}

async function extractDocxText(data: ArrayBuffer) {
  const documentXml = textDecoder.decode(await readZipEntry(new Uint8Array(data), "word/document.xml"));
  const withBreaks = documentXml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/w:tr>/g, "\n");

  const text = decodeXmlEntities(withBreaks.replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  if (!text) {
    throw new Error("This DOCX file did not contain readable text.");
  }

  return text;
}

function decodePdfEscapedString(value: string) {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\([0-7]{1,3})/g, (_, octal: string) => String.fromCharCode(Number.parseInt(octal, 8)));
}

function decodeUtf16Be(hex: string) {
  const chars: string[] = [];
  for (let index = 0; index + 3 < hex.length; index += 4) {
    chars.push(String.fromCharCode(Number.parseInt(hex.slice(index, index + 4), 16)));
  }
  return chars.join("");
}

function parsePdfToUnicodeMap(content: string) {
  const map = new Map<string, string>();
  const bfCharPattern = /beginbfchar([\s\S]*?)endbfchar/g;
  const bfRangePattern = /beginbfrange([\s\S]*?)endbfrange/g;
  const pairPattern = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
  const rangePattern = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(?:<([0-9a-fA-F]+)>|\[([\s\S]*?)\])/g;
  let block: RegExpExecArray | null;

  while ((block = bfCharPattern.exec(content))) {
    let pair: RegExpExecArray | null;
    while ((pair = pairPattern.exec(block[1]))) {
      map.set(pair[1].toLocaleUpperCase(), decodeUtf16Be(pair[2]));
    }
  }

  while ((block = bfRangePattern.exec(content))) {
    let range: RegExpExecArray | null;
    while ((range = rangePattern.exec(block[1]))) {
      const start = Number.parseInt(range[1], 16);
      const end = Number.parseInt(range[2], 16);
      const keyWidth = range[1].length;

      if (range[3]) {
        const destinationStart = Number.parseInt(range[3], 16);
        for (let value = start; value <= end; value += 1) {
          const key = value.toString(16).toLocaleUpperCase().padStart(keyWidth, "0");
          const destination = (destinationStart + value - start).toString(16).toLocaleUpperCase().padStart(range[3].length, "0");
          map.set(key, decodeUtf16Be(destination));
        }
        continue;
      }

      if (range[4]) {
        const values = [...range[4].matchAll(/<([0-9a-fA-F]+)>/g)];
        values.forEach((item, index) => {
          const key = (start + index).toString(16).toLocaleUpperCase().padStart(keyWidth, "0");
          map.set(key, decodeUtf16Be(item[1]));
        });
      }
    }
  }

  return map;
}

function decodePdfHexString(hex: string, unicodeMap: Map<string, string>) {
  const cleanHex = hex.replace(/\s+/g, "").toLocaleUpperCase();
  if (!cleanHex) {
    return "";
  }

  if (unicodeMap.size) {
    const chunks: string[] = [];
    const preferredWidth = cleanHex.length % 4 === 0 ? 4 : 2;
    for (let index = 0; index < cleanHex.length; index += preferredWidth) {
      const key = cleanHex.slice(index, index + preferredWidth);
      chunks.push(unicodeMap.get(key) ?? "");
    }
    const mapped = chunks.join("");
    if (mapped.trim()) {
      return mapped;
    }
  }

  if (cleanHex.startsWith("FEFF")) {
    return decodeUtf16Be(cleanHex.slice(4));
  }

  const bytes: number[] = [];
  for (let index = 0; index + 1 < cleanHex.length; index += 2) {
    bytes.push(Number.parseInt(cleanHex.slice(index, index + 2), 16));
  }
  return latinDecoder.decode(new Uint8Array(bytes));
}

function collectPdfTextOperators(content: string, unicodeMap: Map<string, string>) {
  const pieces: string[] = [];
  const stringPattern = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  const hexPattern = /<([0-9a-fA-F\s]+)>\s*Tj/g;
  const arrayPattern = /\[((?:.|\n)*?)\]\s*TJ/g;
  let match: RegExpExecArray | null;

  while ((match = stringPattern.exec(content))) {
    pieces.push(decodePdfEscapedString(match[0].replace(/\)\s*Tj$/, "").slice(1)));
  }

  while ((match = hexPattern.exec(content))) {
    pieces.push(decodePdfHexString(match[1], unicodeMap));
  }

  while ((match = arrayPattern.exec(content))) {
    const itemPattern = /\((?:\\.|[^\\)])*\)|<([0-9a-fA-F\s]+)>/g;
    let item: RegExpExecArray | null;
    const line: string[] = [];
    while ((item = itemPattern.exec(match[1]))) {
      if (item[0].startsWith("(")) {
        line.push(decodePdfEscapedString(item[0].slice(1, -1)));
      } else {
        line.push(decodePdfHexString(item[1], unicodeMap));
      }
    }
    if (line.length) {
      pieces.push(line.join(""));
    }
  }

  return pieces.join("\n");
}

async function extractPdfText(data: ArrayBuffer) {
  let pdfjs: any;

  try {
    pdfjs = await import(/* webpackIgnore: true */ PDFJS_MODULE_URL);
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  } catch {
    throw new Error("PDF worker failed. Could not load the PDF text extraction engine.");
  }

  let pdfDocument: any;

  try {
    pdfDocument = await pdfjs.getDocument({
      data: new Uint8Array(data),
      useWorkerFetch: true,
      isEvalSupported: false
    }).promise;
  } catch {
    throw new Error("PDF file could not be loaded. The file may be damaged, encrypted, or unsupported.");
  }

  let textItemCount = 0;
  const pages: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const textItems: Array<{ text: string; x: number; y: number }> = textContent.items
        .filter((item: any) => typeof item.str === "string" && item.str.trim())
        .map((item: any) => ({
          text: item.str.trim(),
          x: Number(item.transform?.[4] ?? 0),
          y: Number(item.transform?.[5] ?? 0)
        }));

      textItemCount += textItems.length;

      const lines: Array<{ y: number; items: Array<{ text: string; x: number }> }> = [];
      textItems.forEach((item) => {
        const line = lines.find((candidate) => Math.abs(candidate.y - item.y) < 3);
        if (line) {
          line.items.push({ text: item.text, x: item.x });
          line.y = (line.y + item.y) / 2;
          return;
        }

        lines.push({ y: item.y, items: [{ text: item.text, x: item.x }] });
      });

      const pageText = lines
        .sort((a, b) => b.y - a.y)
        .map((line) =>
          line.items
            .sort((a, b) => a.x - b.x)
            .map((item) => item.text)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim()
        )
        .filter(Boolean)
        .join("\n");

      pages.push(`--- Page ${pageNumber} ---\n${pageText}`);
    }
  } catch {
    throw new Error("PDF text extraction failed while reading pages.");
  }

  const text = pages.join("\n").replace(/[ \t]{2,}/g, " ").trim();

  if (process.env.NODE_ENV === "development") {
    console.debug("[Revisio PDF extraction debug]", {
      pages: pdfDocument.numPages,
      textItems: textItemCount,
      extractedTextLength: text.length,
      first1000Characters: text.slice(0, 1000)
    });
  }

  if (textItemCount === 0 || text.length < 50) {
    throw new Error("PDF has no readable text. This may be a scanned/image-only PDF.");
  }

  return text;
}

export async function extractExamTopicText(file: File) {
  const extension = getExtension(file.name);

  if (extension === ".txt" || extension === ".csv") {
    return file.text();
  }

  const data = await file.arrayBuffer();

  if (extension === ".docx") {
    return extractDocxText(data);
  }

  if (extension === ".pdf") {
    return extractPdfText(data);
  }

  throw new Error("Unsupported file type. Please upload TXT, CSV, DOCX, or a text-based PDF.");
}

export function isSupportedExamTopicFileName(fileName: string) {
  return [".txt", ".csv", ".docx", ".pdf"].includes(getExtension(fileName));
}
