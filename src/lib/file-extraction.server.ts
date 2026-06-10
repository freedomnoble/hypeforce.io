/**
 * Pure-JS file → markdown extractors. Worker-runtime safe.
 * Returns { content, status, error? }.
 */

export const MAX_CONTENT_CHARS = 80_000;

type ExtractResult = {
  content: string;
  status: "ok" | "failed";
  error?: string;
};

function truncate(s: string): string {
  if (s.length <= MAX_CONTENT_CHARS) return s;
  return s.slice(0, MAX_CONTENT_CHARS) + "\n\n_[truncated — file exceeded extraction limit]_";
}

function extOf(name: string): string {
  return name.toLowerCase().split(".").pop() ?? "";
}

async function extractPdf(buf: ArrayBuffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: false });
  if (Array.isArray(text)) {
    return text
      .map((page, i) => `\n\n## Page ${i + 1}\n\n${page.trim()}`)
      .join("\n")
      .trim();
  }
  return String(text).trim();
}

async function extractDocx(buf: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buf) as any });
  return value.trim();
}

async function extractSheet(buf: ArrayBuffer): Promise<string> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
  const parts: string[] = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    const rows = csv.split(/\r?\n/).filter((r) => r.length > 0);
    if (rows.length === 0) continue;
    const header = rows[0].split(",");
    const body = rows.slice(1);
    let md = `\n\n## ${name}\n\n`;
    md += `| ${header.join(" | ")} |\n`;
    md += `| ${header.map(() => "---").join(" | ")} |\n`;
    md += body
      .slice(0, 1000)
      .map((r) => `| ${r.split(",").join(" | ")} |`)
      .join("\n");
    if (body.length > 1000) md += `\n\n_[${body.length - 1000} more rows truncated]_`;
    parts.push(md);
  }
  return parts.join("\n").trim();
}

async function extractCsv(buf: ArrayBuffer): Promise<string> {
  const text = new TextDecoder().decode(buf);
  const rows = text.split(/\r?\n/).filter((r) => r.length > 0);
  if (rows.length === 0) return "";
  const header = rows[0].split(",");
  const body = rows.slice(1, 1001);
  let md = `| ${header.join(" | ")} |\n`;
  md += `| ${header.map(() => "---").join(" | ")} |\n`;
  md += body.map((r) => `| ${r.split(",").join(" | ")} |`).join("\n");
  if (rows.length - 1 > 1000) md += `\n\n_[${rows.length - 1 - 1000} more rows truncated]_`;
  return md;
}

async function extractText(buf: ArrayBuffer): Promise<string> {
  return new TextDecoder().decode(buf);
}

export async function extractToMarkdown(
  filename: string,
  mime: string | null,
  buf: ArrayBuffer,
): Promise<ExtractResult> {
  const ext = extOf(filename);
  const m = (mime ?? "").toLowerCase();
  try {
    let raw = "";
    if (ext === "pdf" || m === "application/pdf") {
      raw = await extractPdf(buf);
    } else if (ext === "docx" || m.includes("officedocument.wordprocessingml")) {
      raw = await extractDocx(buf);
    } else if (
      ext === "xlsx" ||
      ext === "xls" ||
      m.includes("officedocument.spreadsheetml") ||
      m.includes("ms-excel")
    ) {
      raw = await extractSheet(buf);
    } else if (ext === "csv" || m === "text/csv") {
      raw = await extractCsv(buf);
    } else if (
      ext === "md" ||
      ext === "markdown" ||
      ext === "txt" ||
      ext === "json" ||
      ext === "log" ||
      m.startsWith("text/")
    ) {
      raw = await extractText(buf);
    } else {
      return {
        content: "",
        status: "failed",
        error: `Unsupported file type for text extraction (${ext || mime || "unknown"})`,
      };
    }
    return { content: truncate(raw), status: "ok" };
  } catch (e: any) {
    return {
      content: "",
      status: "failed",
      error: e?.message ?? "Extraction error",
    };
  }
}
