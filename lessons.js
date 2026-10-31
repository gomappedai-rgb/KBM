// Course plan (Cracking Chemistry, Ch 6 & Ch 9) and the mapping of Google Drive files to lessons.
// The mapping lives in this browser only (localStorage); file contents stay in Google Drive.

// Default lesson names. A chapter's lessons can be replaced by the sections read from its
// chapter PDF, or edited by hand (saved under PLAN_KEY).
const DEFAULT_CHAPTERS = [
  {
    id: "ch6", number: 6, title: "Atomic Theory",
    lessons: [
      { id: "6.1", title: "Development of atomic models", keywords: ["dalton", "thomson", "rutherford", "bohr", "plum pudding", "gold foil", "atomic model", "history of the atom"] },
      { id: "6.2", title: "Subatomic particles & atomic structure", keywords: ["proton", "neutron", "subatomic", "nucleus", "atomic structure", "atomic number", "mass number", "structure of the atom"] },
      { id: "6.3", title: "Isotopes & relative atomic mass", keywords: ["isotope", "relative atomic mass", "mass spectr", "abundance"] },
      { id: "6.4", title: "Electron configuration & orbitals", keywords: ["electron configuration", "electronic configuration", "orbital", "subshell", "sub-shell", "aufbau", "energy level", "spdf"] },
      { id: "6.5", title: "Ionisation energies", keywords: ["ionisation", "ionization", "successive ionisation", "first ionisation"] },
    ],
  },
  {
    id: "ch9", number: 9, title: "Shapes of Molecules & Intermolecular Forces",
    lessons: [
      { id: "9.1", title: "Shapes of molecules (VSEPR)", keywords: ["vsepr", "shapes of molecules", "molecular shape", "electron pair repulsion", "lone pair", "bond angle", "tetrahedral", "trigonal", "pyramidal", "octahedral", "linear", "bent"] },
      { id: "9.2", title: "Electronegativity & bond polarity", keywords: ["electronegativity", "polarity", "polar bond", "polar molecule", "dipole moment", "non-polar", "nonpolar"] },
      { id: "9.3", title: "Intermolecular forces: London & dipole–dipole", keywords: ["intermolecular", "london", "van der waals", "dispersion", "induced dipole", "permanent dipole", "dipole-dipole", "imf"] },
      { id: "9.4", title: "Hydrogen bonding & physical properties", keywords: ["hydrogen bond", "h-bond", "boiling point", "anomalous", "solubility", "properties of water"] },
    ],
  },
];

// Phrases that name a whole chapter (every phrase in one group must appear).
const CHAPTER_TITLES = { 6: [["atomic theory"], ["atom theory"]], 9: [["shapes of molecules", "intermolecular"]] };

// ---------- effective course plan (defaults + per-chapter overrides) ----------
const PLAN_KEY = "kbm.coursePlan";
const STOPWORDS = new Set(["the", "and", "of", "in", "a", "an", "to", "for", "with", "on", "its", "their", "how", "what", "why", "from", "into", "between", "by", "or", "is", "are"]);

function loadOverrides() {
  try { return JSON.parse(localStorage.getItem(PLAN_KEY)) || {}; } catch { return {}; }
}

// Matching keywords for a lesson name: the whole name as a phrase plus its significant words.
export function keywordsFromTitle(title) {
  const phrase = title.toLowerCase().replace(/[^a-z0-9\s-]+/g, " ").replace(/\s+/g, " ").trim();
  const words = phrase.split(" ").filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  return [...new Set([phrase, ...words])];
}

export let CHAPTERS = [];
export let LESSONS = [];
function rebuild() {
  const o = loadOverrides();
  CHAPTERS = DEFAULT_CHAPTERS.map((c) => o[c.id]?.lessons?.length
    ? { ...c, lessons: o[c.id].lessons.map((l) => ({ id: l.id, title: l.title, keywords: keywordsFromTitle(l.title) })), source: o[c.id].source }
    : c);
  LESSONS = CHAPTERS.flatMap((c) => c.lessons.map((l) => ({ ...l, chapter: c.number, chapterTitle: c.title })));
}
rebuild();

// Replace a chapter's lessons, e.g. with the sections found in its PDF.
// lessons: [{ id: "9.1", title }]; source: { fileId, name } or { manual: true }.
export function setChapterLessons(chapterId, lessons, source) {
  const o = loadOverrides();
  o[chapterId] = { lessons: lessons.map((l) => ({ id: l.id, title: l.title })), source: { ...source, at: new Date().toISOString() } };
  localStorage.setItem(PLAN_KEY, JSON.stringify(o));
  rebuild();
}
export function resetChapter(chapterId) {
  const o = loadOverrides();
  delete o[chapterId];
  localStorage.setItem(PLAN_KEY, JSON.stringify(o));
  rebuild();
}

export const lessonById = (id) => LESSONS.find((l) => l.id === id) || null;
export const chapterById = (id) => CHAPTERS.find((c) => c.id === id) || null;
// A file is linked either to one lesson ("9.1") or to a whole chapter ("ch9").
export const isTarget = (id) => !!(lessonById(id) || chapterById(id));
export function targetLabel(id) {
  const l = lessonById(id), c = chapterById(id);
  return l ? `${l.id} ${l.title}` : c ? `Ch ${c.number} · whole chapter` : "Not linked";
}

// Guess which lesson (or whole chapter) a Drive file belongs to from its name and folder path.
// The file name counts more than the folder path. Returns "" when nothing matches well enough.
export function suggestLesson(file) {
  const norm = (s) => ` ${(s || "").toLowerCase().replace(/[_]+/g, " ")} `;
  const name = norm(file.name), path = norm(file.path), text = path + name;
  // Explicit lesson code: "6.3", "9-1", "chapter 9 / lesson 4"
  const code = text.match(/(?:^|[^\d.])([69])\s*[.\-]\s*([1-9]\d?)(?![\d.])/);
  if (code && lessonById(`${code[1]}.${code[2]}`)) return `${code[1]}.${code[2]}`;
  const chapIn = (s) => s.match(/\b(?:ch|chap|chapter|unit|topic)\.?\s*0?([69])\b/)?.[1];
  const titleIn = (s) => Object.keys(CHAPTER_TITLES).find((n) => CHAPTER_TITLES[n].some((all) => all.every((k) => s.includes(k))));
  const num = text.match(/\b(?:lesson|les|l)\.?\s*0?([1-9]\d?)\b/);
  const chap = chapIn(text) || titleIn(text);
  if (chap && num && lessonById(`${chap}.${num[1]}`)) return `${chap}.${num[1]}`;
  // A file named after the chapter itself (e.g. "Ch9 Shapes of Molecules & Intermolecular Forces.pdf").
  const nameTitle = titleIn(name);
  if (nameTitle) return `ch${nameTitle}`;

  let best = "", bestScore = 0, bestFromName = false;
  for (const l of LESSONS) {
    if (chap && String(l.chapter) !== chap) continue;
    const weight = (k) => (k.includes(" ") ? 2 : 1);
    const nameScore = l.keywords.reduce((s, k) => s + (name.includes(k) ? 2 * weight(k) : 0), 0);
    const score = nameScore + l.keywords.reduce((s, k) => s + (!name.includes(k) && path.includes(k) ? weight(k) : 0), 0);
    if (score > bestScore) { best = l.id; bestScore = score; bestFromName = nameScore > 0; }
  }
  // Only the folder matched, and the folder is named after the chapter: treat as a chapter file.
  const pathTitle = titleIn(path);
  if (best && !bestFromName && pathTitle) return `ch${pathTitle}`;
  if (best) return best;
  // Only a chapter number in the file name (e.g. "Ch6 notes.pdf"): link to the whole chapter.
  const nameChap = chapIn(name);
  return nameChap ? `ch${nameChap}` : "";
}

// ---------- saved Drive library ----------
const KEY = "kbm.driveLibrary";

export function loadLibrary() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
}

export function saveLibrary(lib) {
  if (lib) localStorage.setItem(KEY, JSON.stringify(lib));
  else localStorage.removeItem(KEY);
}

// ---------- titles read from the PDFs ----------
// lib.headings[fileId] = { modifiedTime, sections: [{ chapter, n, title, size }] } (from pdf-sections.js)

// What a PDF's own headings say about it: the headings in its largest font are its own titles;
// smaller numbered lines are mentions or contents entries.
//  - one such heading ("6.1 The Nuclear Atom")   -> { kind: "lesson", chapter, n, title }
//  - several in one chapter (a whole chapter PDF) -> { kind: "chapter", chapter, sections }
export function classifyHeadings(sections) {
  if (!sections?.length) return null;
  const max = Math.max(...sections.map((s) => s.size || 0));
  const primary = sections.filter((s) => (s.size || 0) >= max * 0.85);
  const byChapter = {};
  for (const s of primary) (byChapter[s.chapter] ||= []).push(s);
  const [chapter, list] = Object.entries(byChapter).sort((a, b) => b[1].length - a[1].length)[0];
  if (list.length >= 2) return { kind: "chapter", chapter: +chapter, sections: list };
  return { kind: "lesson", chapter: +chapter, n: list[0].n, title: list[0].title };
}

const headingTarget = (k) => (!k ? "" : k.kind === "lesson" ? `${k.chapter}.${k.n}` : `ch${k.chapter}`);

// Lesson names for one chapter from the PDFs: the sections of its whole-chapter PDF (else the
// default lessons), with each lesson PDF's own title put on its lesson number.
// Returns { lessons, source } or null when no PDF gave a title for this chapter.
export function planFromPdfs(lib, chapterId) {
  const c = DEFAULT_CHAPTERS.find((x) => x.id === chapterId);
  if (!lib?.headings || !c) return null;
  const read = lib.files
    .filter((f) => lib.headings[f.id]?.sections?.length)
    .map((f) => ({ f, all: lib.headings[f.id].sections.filter((s) => s.chapter === c.number), k: classifyHeadings(lib.headings[f.id].sections) }))
    .filter((x) => x.all.length);
  // Whole-chapter PDF: one whose headings span the chapter, or one linked to the chapter (by name or by hand).
  const whole = read.find((x) => x.k?.kind === "chapter" && x.k.chapter === c.number)
    || read.find((x) => lib.map[x.f.id] === chapterId && x.all.length >= 2);
  const sections = whole ? (whole.k?.kind === "chapter" ? whole.k.sections : whole.all) : null;
  const singles = read.filter((x) => x !== whole && x.k?.kind === "lesson" && x.k.chapter === c.number);
  if (!whole && !singles.length) return null;

  const lessons = sections ? sections.map((s) => ({ id: `${c.number}.${s.n}`, title: s.title })) : c.lessons.map((l) => ({ id: l.id, title: l.title }));
  for (const { k } of singles) {
    const id = `${c.number}.${k.n}`, i = lessons.findIndex((l) => l.id === id);
    if (i >= 0) lessons[i] = { id, title: k.title }; else lessons.push({ id, title: k.title });
  }
  lessons.sort((a, b) => +a.id.split(".")[1] - +b.id.split(".")[1]);
  const names = [whole && `“${whole.f.name}”`, singles.length && `${singles.length} lesson PDF${singles.length > 1 ? "s" : ""}`].filter(Boolean);
  return { lessons, source: { name: names.join(" and "), fileIds: [whole?.f.id, ...singles.map((x) => x.f.id)].filter(Boolean) } };
}

// Merge a fresh folder scan with the previous one: keep the links the teacher set by hand and the
// titles already read from unchanged PDFs; (re)match every other file, by its own PDF title when
// one was read, otherwise by its name and folder.
export function buildLibrary(folder, files, previous) {
  const same = previous?.folder?.id === folder.id;
  const oldMap = same ? previous.map || {} : {}, oldManual = same ? previous.manual || {} : {}, oldHeadings = same ? previous.headings || {} : {};
  const map = {}, manual = {}, headings = {};
  for (const f of files) {
    if (oldHeadings[f.id]?.modifiedTime === f.modifiedTime) headings[f.id] = oldHeadings[f.id];
    if (oldManual[f.id]) { map[f.id] = oldMap[f.id] ?? ""; manual[f.id] = true; continue; }
    const fromTitle = headingTarget(classifyHeadings(headings[f.id]?.sections));
    map[f.id] = isTarget(fromTitle) ? fromTitle : suggestLesson(f);
  }
  return { folder, files, map, manual, headings, scannedAt: new Date().toISOString() };
}

// PDFs whose titles haven't been read yet (or changed since).
export function pdfsToRead(lib, force = false) {
  return lib ? lib.files.filter((f) => (f.mimeType === PDF || /\.pdf$/i.test(f.name)) && (force || lib.headings?.[f.id]?.modifiedTime !== f.modifiedTime)) : [];
}

// The teacher links a file to a lesson / chapter ("" = unlink). Kept across rescans.
export function setLink(lib, fileId, target) {
  lib.map[fileId] = target;
  (lib.manual ||= {})[fileId] = true;
}

// Files for a lesson: those linked to the lesson first, then whole-chapter files. PDFs first in each group.
export function filesForLesson(lib, lessonId) {
  const l = lessonById(lessonId);
  if (!lib || !l) return [];
  const chapterId = `ch${l.chapter}`;
  const rank = (f) => (lib.map[f.id] === lessonId ? 0 : 2) + (f.mimeType === PDF ? 0 : 1);
  return lib.files.filter((f) => lib.map[f.id] === lessonId || lib.map[f.id] === chapterId).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

export function chapterFiles(lib, chapterId) {
  return lib ? lib.files.filter((f) => lib.map[f.id] === chapterId) : [];
}

export function unassignedFiles(lib) {
  return lib ? lib.files.filter((f) => !isTarget(lib.map[f.id])) : [];
}

export const PDF = "application/pdf";
