/**
 * Đọc sheet đầu tiên của tệp .xlsx (không cần thư viện ngoài).
 * .xlsx = zip chứa XML; giải nén bằng DecompressionStream("deflate-raw") của trình duyệt.
 * Ô ngày (định dạng ngày của Excel) trả về YYYY-MM-DD.
 */

type ZipEntry = { name: string; method: number; compSize: number; offset: number };

const readEntries = (view: DataView): ZipEntry[] => {
  let eocd = -1;
  for (let i = view.byteLength - 22; i >= Math.max(0, view.byteLength - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Tệp .xlsx không hợp lệ hoặc bị hỏng.");
  const count = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) break;
    const method = view.getUint16(ptr + 10, true);
    const compSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const offset = view.getUint32(ptr + 42, true);
    const name = decoder.decode(new Uint8Array(view.buffer, view.byteOffset + ptr + 46, nameLen));
    entries.push({ name, method, compSize, offset });
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
};

const readEntry = async (buffer: ArrayBuffer, entry: ZipEntry): Promise<string> => {
  const view = new DataView(buffer);
  const nameLen = view.getUint16(entry.offset + 26, true);
  const extraLen = view.getUint16(entry.offset + 28, true);
  const start = entry.offset + 30 + nameLen + extraLen;
  const data = new Uint8Array(buffer, start, entry.compSize);
  if (entry.method === 0) return new TextDecoder().decode(data);
  if (entry.method !== 8) throw new Error("Tệp .xlsx dùng kiểu nén không hỗ trợ.");
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Trình duyệt chưa hỗ trợ đọc .xlsx. Hãy lưu tệp dạng CSV rồi thử lại.");
  }
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
};

const colIndex = (ref: string) => {
  const letters = ref.replace(/[0-9]/g, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

const BUILTIN_DATE_FMTS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

const excelSerialToIso = (serial: number) => {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return String(serial);
  return d.toISOString().slice(0, 10);
};

export const readXlsxFirstSheet = async (buffer: ArrayBuffer): Promise<string[][]> => {
  const entries = readEntries(new DataView(buffer));
  const byName = new Map(entries.map((e) => [e.name, e]));
  const parser = new DOMParser();
  const xml = async (name: string) => {
    const entry = byName.get(name);
    return entry ? parser.parseFromString(await readEntry(buffer, entry), "application/xml") : null;
  };

  // Sheet đầu tiên theo workbook.xml (fallback sheet1.xml).
  let sheetPath = "xl/worksheets/sheet1.xml";
  const workbook = await xml("xl/workbook.xml");
  const rels = await xml("xl/_rels/workbook.xml.rels");
  const firstSheet = workbook?.getElementsByTagName("sheet")[0];
  const rid = firstSheet?.getAttribute("r:id");
  if (rid && rels) {
    for (const rel of Array.from(rels.getElementsByTagName("Relationship"))) {
      if (rel.getAttribute("Id") === rid) {
        const target = rel.getAttribute("Target") ?? "";
        sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
      }
    }
  }
  const sheet = await xml(sheetPath);
  if (!sheet) throw new Error("Không tìm thấy trang tính trong tệp .xlsx.");

  const shared: string[] = [];
  const sst = await xml("xl/sharedStrings.xml");
  if (sst) {
    for (const si of Array.from(sst.getElementsByTagName("si"))) {
      shared.push(Array.from(si.getElementsByTagName("t")).map((t) => t.textContent ?? "").join(""));
    }
  }

  // Style index → có phải định dạng ngày không.
  const dateStyles = new Set<number>();
  const styles = await xml("xl/styles.xml");
  if (styles) {
    const customDate = new Set<number>();
    for (const fmt of Array.from(styles.getElementsByTagName("numFmt"))) {
      const code = (fmt.getAttribute("formatCode") ?? "").replace(/"[^"]*"|\[[^\]]*\]/g, "").toLowerCase();
      if (/[dy]/.test(code) || /m{1,4}[^a-z]*[dy]|[dy][^a-z]*m/.test(code)) {
        customDate.add(Number(fmt.getAttribute("numFmtId")));
      }
    }
    const cellXfs = styles.getElementsByTagName("cellXfs")[0];
    Array.from(cellXfs?.getElementsByTagName("xf") ?? []).forEach((xf, index) => {
      const id = Number(xf.getAttribute("numFmtId") ?? 0);
      if (BUILTIN_DATE_FMTS.has(id) || customDate.has(id)) dateStyles.add(index);
    });
  }

  const table: string[][] = [];
  for (const row of Array.from(sheet.getElementsByTagName("row"))) {
    const rowNum = Number(row.getAttribute("r") ?? table.length + 1) - 1;
    const cells: string[] = [];
    let next = 0;
    for (const c of Array.from(row.getElementsByTagName("c"))) {
      const ref = c.getAttribute("r");
      const index = ref ? colIndex(ref) : next;
      next = index + 1;
      const type = c.getAttribute("t");
      const raw = c.getElementsByTagName("v")[0]?.textContent ?? "";
      let value = raw;
      if (type === "s") value = shared[Number(raw)] ?? "";
      else if (type === "inlineStr") value = Array.from(c.getElementsByTagName("t")).map((t) => t.textContent ?? "").join("");
      else if (type === "b") value = raw === "1" ? "TRUE" : "FALSE";
      else if (raw && dateStyles.has(Number(c.getAttribute("s") ?? -1)) && !Number.isNaN(Number(raw))) {
        value = excelSerialToIso(Number(raw));
      }
      cells[index] = value;
    }
    table[rowNum] = Array.from(cells, (cell) => cell ?? "");
  }
  return Array.from(table, (row) => row ?? []).filter((row) => row.some((cell) => cell.trim() !== ""));
};
