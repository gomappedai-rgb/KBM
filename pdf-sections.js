// Reads the numbered sections ("9.1 …", "9.2 …") of a chapter PDF in the browser with pdf.js.
// 1) PDF bookmarks (outline), if they contain numbered sections;
// 2) otherwise the page text: for each section number, the occurrence in the largest font
//    (the heading, rather than its line in the table of contents).
const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";
const WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
const MAX_PAGES = 80;

let pdfjsLib = null;
async function loadPdfJs() {
  if (!pdfjsLib) {
    pdfjsLib = await import(PDFJS);
    pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER;
  }
  return pdfjsLib;
}

function cleanTitle(s) {
  return s
    .replace(/\s*(?:[.·…_]\s*){2,}\d{1,4}\s*$/, "") // dot leaders + page number (contents page)
    .replace(/[\s.:·…–—-]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

// "9.1 Shapes of Molecules" -> { n: 1, title: "Shapes of Molecules" } when the chapter is 9.
function parseHeading(line, chapter) {
  const m = line.match(/^\s*(?:section\s+)?(\d{1,2})\s*\.\s*(\d{1,2})(?![.\d])\s*[:.)\-–—]?\s+(.+)$/i);
  if (!m || +m[1] !== chapter) return null;
  const title = cleanTitle(m[3]);
  if (title.length < 3 || title.length > 100) return null;
  if (!/^[A-Z(“"']/.test(title)) return null; // headings start with a capital ("9.1 g of salt" is not one)
  if (/^(figure|fig\.|table|graph|diagram)\b/i.test(title)) return null;
  if ((title.match(/[a-z]/gi) || []).length < 3) return null;
  return { n: +m[2], title };
}

// Text lines of one page, rebuilt from pdf.js text items (same baseline, left to right).
function pageLines(items) {
  const rows = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const [, , c, d, x, y] = it.transform;
    const size = Math.hypot(c, d) || it.height || 0;
    let row = rows.find((r) => Math.abs(r.y - y) <= Math.max(2, size * 0.3));
    if (!row) rows.push((row = { y, items: [] }));
    row.items.push({ x, w: it.width || 0, str: it.str, size });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map((r) => {
    r.items.sort((a, b) => a.x - b.x);
    let text = "", end = null;
    for (const it of r.items) {
      if (end !== null && it.x - end > it.size * 0.15 && !text.endsWith(" ") && !it.str.startsWith(" ")) text += " ";
      text += it.str;
      end = it.x + it.w;
    }
    return { text: text.replace(/\s+/g, " ").trim(), size: Math.max(...r.items.map((i) => i.size)) };
  });
}

function flattenOutline(items, out = []) {
  for (const it of items || []) { out.push(it.title || ""); flattenOutline(it.items, out); }
  return out;
}

const sortByNumber = (map) => [...map.values()].sort((a, b) => a.n - b.n);

// Returns [{ n, title }] sorted by section number (n is the part after the dot).
export async function extractSections(data, chapter) {
  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  try {
    const fromOutline = new Map();
    for (const t of flattenOutline(await pdf.getOutline().catch(() => null))) {
      const h = parseHeading(t, chapter);
      if (h && !fromOutline.has(h.n)) fromOutline.set(h.n, h);
    }
    if (fromOutline.size >= 2) return sortByNumber(fromOutline);

    const best = new Map(); // n -> { n, title, size }
    const pages = Math.min(pdf.numPages, MAX_PAGES);
    for (let p = 1; p <= pages; p++) {
      const page = await pdf.getPage(p);
      const lines = pageLines((await page.getTextContent()).items);
      lines.forEach((line, i) => {
        let h = parseHeading(line.text, chapter);
        // Number on its own line, title on the next one.
        if (!h && new RegExp(`^${chapter}\\s*\\.\\s*\\d{1,2}$`).test(line.text) && lines[i + 1])
          h = parseHeading(`${line.text} ${lines[i + 1].text}`, chapter);
        if (!h) return;
        const cur = best.get(h.n);
        if (!cur || line.size > cur.size + 0.5) best.set(h.n, { ...h, size: line.size });
      });
      page.cleanup();
    }
    return best.size >= 2 ? sortByNumber(best).map(({ n, title }) => ({ n, title })) : [];
  } finally {
    pdf.destroy();
  }
}
