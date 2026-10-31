// Reads numbered section headings ("6.1 …", "9.2 …") from a PDF in the browser with pdf.js.
// 1) PDF bookmarks (outline), if they contain numbered sections;
// 2) otherwise the page text: for each section number, the occurrence in the largest font
//    (the heading, rather than its line in the table of contents or a mention in the text).
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

// "9.1 Shapes of Molecules" -> { chapter: 9, n: 1, title: "Shapes of Molecules" } if 9 is one of `chapters`.
function parseHeading(line, chapters) {
  const m = line.match(/^\s*(?:section\s+)?(\d{1,2})\s*\.\s*(\d{1,2})(?![.\d])\s*[:.)\-–—]?\s+(.+)$/i);
  if (!m || !chapters.includes(+m[1])) return null;
  const title = cleanTitle(m[3]);
  if (title.length < 3 || title.length > 100) return null;
  if (!/^[A-Z(“"']/.test(title)) return null; // headings start with a capital ("9.1 g of salt" is not one)
  if (/^(figure|fig\.|table|graph|diagram)\b/i.test(title)) return null;
  if ((title.match(/[a-z]/gi) || []).length < 3) return null;
  return { chapter: +m[1], n: +m[2], title };
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

const byNumber = (a, b) => a.chapter - b.chapter || a.n - b.n;

// The largest-font line on the first page, as the title of a PDF whose heading has no number
// (e.g. "The Bohr Model", or "Lesson 2: The Bohr Model"). Skips book/chapter banners.
function firstPageTitle(lines) {
  const candidates = lines
    .map((l) => ({ ...l, text: cleanTitle(l.text.replace(/^(?:lesson|topic|section|unit)\s*[\d.]+\s*[:.\-–—]?\s*/i, "")) }))
    .filter((l) => l.text.length >= 3 && l.text.length <= 100 && (l.text.match(/[a-z]/gi) || []).length >= 3)
    .filter((l) => !/^(chapter\b|ch\.?\s*\d|unit\s*\d|contents\b|cracking chemistry\b|page\s*\d)/i.test(l.text) && !/^\d{1,2}\s*\.\s*\d{1,2}\b/.test(l.text));
  if (!candidates.length) return "";
  const top = candidates.reduce((a, b) => (b.size > a.size + 0.5 ? b : a));
  if (lines.length === 1) return top.text;
  const body = lines.map((l) => l.size).sort((a, b) => a - b)[Math.floor((lines.length - 1) / 2)];
  return top.size > body * 1.15 ? top.text : ""; // must stand out from the body text
}

// Numbered headings of the given chapters, plus the first page's title:
// { sections: [{ chapter, n, title, size }] (sorted), topTitle }.
// `size` is the font size of the heading (all 1 when read from bookmarks).
export async function readHeadings(data, chapters) {
  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  try {
    const first = pdf.numPages ? pageLines((await (await pdf.getPage(1)).getTextContent()).items) : [];
    const topTitle = firstPageTitle(first);
    const fromOutline = new Map();
    for (const t of flattenOutline(await pdf.getOutline().catch(() => null))) {
      const h = parseHeading(t, chapters);
      if (h && !fromOutline.has(`${h.chapter}.${h.n}`)) fromOutline.set(`${h.chapter}.${h.n}`, { ...h, size: 1 });
    }
    if (fromOutline.size) return { sections: [...fromOutline.values()].sort(byNumber), topTitle };

    const best = new Map();
    const pages = Math.min(pdf.numPages, MAX_PAGES);
    for (let p = 1; p <= pages; p++) {
      const page = await pdf.getPage(p);
      const lines = p === 1 ? first : pageLines((await page.getTextContent()).items);
      lines.forEach((line, i) => {
        let h = parseHeading(line.text, chapters);
        // Number on its own line, title on the next one.
        if (!h && /^\d{1,2}\s*\.\s*\d{1,2}$/.test(line.text) && lines[i + 1]) h = parseHeading(`${line.text} ${lines[i + 1].text}`, chapters);
        if (!h) return;
        const key = `${h.chapter}.${h.n}`, cur = best.get(key);
        if (!cur || line.size > cur.size + 0.5) best.set(key, { ...h, size: Math.round(line.size * 10) / 10 });
      });
      page.cleanup();
    }
    return { sections: [...best.values()].sort(byNumber), topTitle };
  } finally {
    pdf.destroy();
  }
}
