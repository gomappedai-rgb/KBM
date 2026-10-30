import { createGraphClient, friendlyError } from "./graph.js";
import { createDriveClient } from "./drive.js";
import { CHAPTERS, lessonById, chapterById, isTarget, targetLabel, loadLibrary, saveLibrary, buildLibrary, setLink, filesForLesson, chapterFiles, unassignedFiles, setChapterLessons, resetChapter, PDF } from "./lessons.js";
import { extractSections } from "./pdf-sections.js";

const graph = createGraphClient(window.APP_CONFIG);
const drive = createDriveClient(window.APP_CONFIG);
let driveLib = loadLibrary(); // { folder, files, map: fileId -> lessonId, scannedAt }
const SUGGESTED_LESSON = "9.1";
const $ = (s, root = document) => root.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const state = {
  page: "teaching", selectedClass: "12A Chemistry", prepared: false, published: false, lessonId: SUGGESTED_LESSON, viewFileId: null,
  resources: [
    { name: "Shapes of molecules (VSEPR) · worked examples", type: "SLIDES", topic: "Ch 9 · Shapes of molecules", level: "Core", status: "Approved", uses: 6, date: "Yesterday" },
    { name: "Bond angles & lone pairs practice", type: "WORKSHEET", topic: "Ch 9 · Shapes of molecules", level: "Core", status: "Approved", uses: 4, date: "12 Oct" },
    { name: "Intermolecular forces · boiling point trends (extension)", type: "PDF", topic: "Ch 9 · Intermolecular forces", level: "Extension", status: "Needs review", uses: 0, date: "14 Oct" },
    { name: "Cracking Chemistry course plan · Ch 6 & Ch 9", type: "PLAN", topic: "Course plan", level: "All levels", status: "Approved", uses: 3, date: "10 Oct" },
    { name: "Atomic theory · electron configuration", type: "SLIDES", topic: "Ch 6 · Atomic theory", level: "Core", status: "Approved", uses: 2, date: "8 Oct" },
  ],
  students: [
    { name: "Amelia Hart", initials: "AH", topic: "Shapes of molecules", score: "4 / 8", note: "Ignored lone pairs when predicting bond angles", state: "Needs practice" },
    { name: "Noah Williams", initials: "NW", topic: "Electron configuration", score: "8 / 8", note: "Ready for an extension question", state: "On track" },
    { name: "Oliver Chen", initials: "OC", topic: "Intermolecular forces", score: "5 / 8", note: "Confused hydrogen bonds with covalent bonds", state: "Needs practice" },
  ],
  tasks: [
    { title: "Shapes of molecules · exit ticket", className: "12A Chemistry", due: "Today, 3:30 pm", submitted: 21, total: 28, review: 3, type: "Homework" },
    { title: "Intermolecular forces & boiling points", className: "12B Chemistry", due: "Today, 4:00 pm", submitted: 24, total: 30, review: 2, type: "Homework" },
    { title: "Atomic theory retrieval practice", className: "11C Chemistry", due: "Tomorrow, 9:00 am", submitted: 18, total: 26, review: 0, type: "Practice" },
  ],
};

function topTitle(eyebrow, title, subtitle, actions = "") {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div><div class="heading-actions">${actions}</div></div>`;
}
function tag(text, tone = "neutral") { return `<span class="tag ${tone}">${text}</span>`; }
function renderTeaching() {
  if (state.published) return renderPublished();
  const action = state.prepared
    ? `<div class="ready-banner"><span class="ready-check">✓</span><div><b>Ready for your review</b><span>Your changes are saved in this browser.</span></div><button class="text-button" data-action="edit-plan">Continue editing</button></div>`
    : `<div class="decision-card"><div class="decision-head"><div><span class="signal-label"><i></i> DECISION READY</span><h2>Teach shapes of molecules (VSEPR) next</h2><p>Based on the latest learning signals from your class.</p></div><button class="why-button" data-action="why">ⓘ Why this?</button></div><div class="signal-strip"><div class="signal"><span class="signal-icon lilac">↘</span><span><b>8 students</b><small>missed bond angle questions</small></span></div><div class="signal"><span class="signal-icon mint">◷</span><span><b>Last lesson</b><small>Ch 6 · electron configuration · 2 days ago</small></span></div><div class="signal"><span class="signal-icon peach">↗</span><span><b>Topic accuracy</b><small>54% · below your 70% target</small></span></div></div><div class="recommendation-grid"><div class="rec-main"><div class="rec-overline">SUGGESTED NEXT LESSON</div><h3>Shapes of molecules (VSEPR)</h3><div class="rec-meta"><span>◉ 12A Chemistry</span><span>◷ 50 minutes</span><span>◎ Ch 9 · Cracking Chemistry</span></div><div class="rec-footer"><span class="material-chip">▧</span><span><b>Core resource</b><small>Shapes of molecules (VSEPR) · worked examples</small></span><span class="approved-dot">Approved</span></div></div><div class="rec-side"><div class="rec-overline">ALSO INCLUDE</div><div class="small-rec"><span class="material-chip mint-bg">▤</span><span><b>Exit ticket</b><small>8 questions · about 10 min</small></span></div><div class="small-rec"><span class="material-chip peach-bg">✳</span><span><b>Extra practice</b><small>3 students could benefit</small></span></div><button class="subtle-link" data-action="prepare">Review full lesson <span>→</span></button></div></div><div class="decision-foot"><span><span class="lock-icon">▣</span> Nothing reaches students until you approve and publish.</span><div><button class="btn btn-secondary" data-action="edit-plan">Edit suggestion</button><button class="btn btn-primary" data-action="approve">Approve &amp; publish <span>→</span></button></div></div></div>`;
  return `${topTitle("THURSDAY, 15 OCTOBER 2026", "Good morning, Sarah <span class='wave'>✳</span>", "Here’s the next teaching decision for your classes.", `<button class="btn btn-secondary" data-page="classes">View classes <span>→</span></button>`)}
    <div class="overview-row"><div class="mini-stat"><span class="stat-icon lilac">▣</span><div><small>CLASSES TODAY</small><b>3 <span>classes</span></b></div><span class="stat-note">Next at 9:15</span></div><div class="mini-stat"><span class="stat-icon mint">☷</span><div><small>TO REVIEW</small><b>8 <span>submissions</span></b></div><span class="stat-note positive">3 need attention</span></div><div class="mini-stat"><span class="stat-icon peach">▤</span><div><small>RESOURCE LIBRARY</small><b>${state.resources.filter(r=>r.status==='Approved').length} <span>approved</span></b></div><span class="stat-note">1 needs review</span></div></div>
    ${action}<div class="section-head"><div><h2>Today’s classes</h2><p>Your teaching schedule at a glance.</p></div><button class="subtle-link" data-page="classes">All classes <span>→</span></button></div><div class="class-cards">${classCard("09:15", "12A Chemistry", "Ch 9 · Shapes of molecules (VSEPR)", "28 students", "Next up", true, "9.1")}${classCard("11:00", "12B Chemistry", "Ch 9 · Intermolecular forces", "30 students", "In 2 hours", false, "9.3")}${classCard("13:30", "11C Chemistry", "Ch 6 · Electron configuration", "26 students", "This afternoon", false, "6.4")}</div>`;
}
function classCard(time, name, topic, count, status, active, lessonId) { const pdf=filesForLesson(driveLib,lessonId).find(isPdf), lesson=lessonById(lessonId); if(lesson) topic=`Ch ${lesson.chapter} · ${esc(lesson.title)}`; return `<article class="class-card ${active?"class-next":""}"><div class="class-time">${time}<span>${active?"NEXT UP":"TODAY"}</span></div><div class="class-card-body"><div class="class-card-title"><b>${name}</b>${active?tag("Next up","purple"):""}</div><p>${topic} · <button class="lesson-link" data-action="open-lesson" data-lesson="${lessonId}">Lesson ${lessonId}</button></p><span class="class-students">♙ ${count}</span></div>${pdf?`<a class="pdf-chip" href="${esc(pdf.webViewLink)}" target="_blank" rel="noopener" title="Open ${esc(pdf.name)}">PDF ↗</a>`:""}<button class="arrow-button" data-action="open-class" data-class="${name}" aria-label="Open ${name}">↗</button></article>`; }
function renderPublished() { return `${topTitle("PUBLISHED", "You’re all set, Sarah", "Your approved lesson is now available to students.")}<div class="success-card"><div class="success-icon">✓</div><div><h2>Shapes of molecules (VSEPR) is published</h2><p>12A Chemistry · Today · 50 minutes</p><div class="success-meta"><span>28 student tasks created</span><span>4 approved resources included</span></div></div><button class="btn btn-secondary" data-page="assignments">View assignments →</button></div><div class="section-head"><div><h2>What happens next</h2><p>Student work will feed into your next teaching decision.</p></div></div><div class="next-steps"><div><span>01</span><b>Students complete the lesson</b><p>They’ll see the materials and tasks you approved.</p></div><div><span>02</span><b>Results update class signals</b><p>Submissions refresh topic accuracy and class summary.</p></div><div><span>03</span><b>Your next lesson adapts</b><p>KBM prepares a new suggestion for your review.</p></div></div>`; }
function renderPrepare() {
 return `${topTitle("LESSON PREPARATION", "Review your next lesson", "Everything in one place. Make it yours, then approve when you’re ready.", `<button class="btn btn-secondary" data-page="teaching">← Back to teaching</button>`)}<div class="prepare-layout"><section class="panel lesson-panel"><div class="panel-header"><div><span class="eyebrow">12A CHEMISTRY · TODAY</span><h2>Shapes of molecules (VSEPR)</h2></div>${tag("Suggested","purple")}</div><div class="why-inline"><span>✧</span><p><b>Why this lesson?</b> 8 students missed bond angle questions in the last homework. Topic accuracy is 54%, so a focused recap may help before moving on to intermolecular forces.</p></div><div class="field-row"><label>Teaching objective<textarea id="lesson-objective" rows="2">Use VSEPR theory to predict the shapes and bond angles of molecules and ions, including the effect of lone pairs (Cracking Chemistry, Chapter 9).</textarea></label></div><div class="lesson-section"><div class="lesson-section-head"><div><h3>Lesson materials</h3><small>Approved resources only</small></div><button class="small-add" data-action="add-resource">＋ Add</button></div><div class="editable-row"><span class="drag">⠿</span><span class="material-chip">▧</span><div><b>Shapes of molecules (VSEPR) · worked examples</b><small>Core resource · 12 slides</small></div>${tag("Core","neutral")}<button class="remove-row" title="Remove">×</button></div><div class="editable-row"><span class="drag">⠿</span><span class="material-chip mint-bg">▤</span><div><b>Lone pairs &amp; bond angles: common misconceptions</b><small>Supplementary slides · 6 slides</small></div>${tag("Support","mint")}<button class="remove-row" title="Remove">×</button></div>${driveMaterials(SUGGESTED_LESSON)}</div><div class="lesson-section"><div class="lesson-section-head"><div><h3>Class questions</h3><small>Choose questions for this lesson</small></div><button class="small-add" data-action="add-question">＋ Add question</button></div><div class="question-row"><span class="question-number">01</span><span><b>Predict the shape and bond angle of CH₄</b><small>Retrieval · 2 min</small></span><button class="remove-row">×</button></div><div class="question-row"><span class="question-number">02</span><span><b>Explain why the H–N–H bond angle in NH₃ is 107°, not 109.5°</b><small>Guided practice · 3 min</small></span><button class="remove-row">×</button></div></div><div class="lesson-section"><div class="lesson-section-head"><div><h3>Homework</h3><small>One task for every student</small></div><label class="toggle"><input type="checkbox" checked><span></span></label></div><div class="homework-box"><div><b>Shapes of molecules · exit ticket</b><small>8 questions · estimated 10 minutes</small></div><div class="homework-options"><label>Due date <input type="date" value="2026-10-16"></label><label>Required <select><option>Required</option><option>Optional</option></select></label></div></div></div><div class="lesson-section"><div class="lesson-section-head"><div><h3>Extra practice</h3><small>Suggested from individual topic results</small></div></div><div class="practice-students"><div class="student-mini"><div class="avatar small-avatar">AH</div><span><b>Amelia Hart</b><small>Shapes of molecules · 4/8 correct</small></span><label class="toggle"><input type="checkbox" checked><span></span></label></div><div class="student-mini"><div class="avatar small-avatar">OC</div><span><b>Oliver Chen</b><small>Shapes of molecules · 5/8 correct</small></span><label class="toggle"><input type="checkbox" checked><span></span></label></div><div class="student-mini"><div class="avatar small-avatar">LP</div><span><b>Leo Patel</b><small>Shapes of molecules · 4/8 correct</small></span><label class="toggle"><input type="checkbox"><span></span></label></div></div></div><div class="prepare-footer"><span>Last saved just now</span><button class="btn btn-secondary" data-action="save-plan">Save draft</button><button class="btn btn-primary" data-action="approve">Approve &amp; publish <span>→</span></button></div></section><aside class="prepare-aside"><div class="panel side-panel"><div class="aside-icon">✧</div><h3>Decision signals</h3><p>These signals shaped this recommendation.</p><div class="aside-signal"><b>54%</b><span>Shapes of molecules accuracy<br><small>Across 12A · last 2 assignments</small></span></div><div class="aside-signal"><b>8</b><span>Students missed a key step<br><small>Most common: not counting lone pairs</small></span></div><div class="aside-signal"><b>2 days</b><span>Since last chemistry lesson<br><small>Ch 6 · Electron configuration</small></span></div><button class="text-button" data-action="why">See all signals ↗</button></div><div class="privacy-note"><span>▣</span><p><b>Your approval is the only way forward.</b><br>Students see only lessons you approve and publish.</p></div></aside></div>`;
}
function renderClasses() {
 const roster = state.students.map((s,i)=>`<tr><td><div class="roster-name"><div class="avatar small-avatar avatar-${i}">${s.initials}</div><b>${s.name}</b></div></td><td>${s.topic}</td><td><b>${s.score}</b></td><td><span class="status-dot ${s.state==='On track'?'green':''}"></span>${s.state}</td><td><button class="row-more" title="More">···</button></td></tr>`).join("");
 return `${topTitle("YOUR CLASSES", "Classes", "A clear picture of how each class is progressing.", `<button class="btn btn-secondary" data-action="schedule">＋ Add class</button>`)}<div class="class-tabs">${["12A Chemistry","12B Chemistry","11C Chemistry"].map(n=>`<button class="class-tab ${state.selectedClass===n?'selected':''}" data-class-tab="${n}">${n}</button>`).join("")}</div><div class="class-summary-grid"><div class="panel class-summary"><div class="summary-class-title"><div><span class="eyebrow">YEAR ${state.selectedClass.slice(0,2)} · CRACKING CHEMISTRY</span><h2>${state.selectedClass}</h2><p>Ms Sarah Collins · Chemistry</p></div>${tag("Today · 09:15","purple")}</div><div class="summary-metrics"><div><span>STUDENTS</span><b>28</b><small>Enrolled in this class</small></div><div><span>LAST ASSIGNMENT</span><b>76%</b><small>Average completion</small></div><div><span>TOPIC TO FOCUS</span><b>VSEPR shapes</b><small>54% accuracy · needs review</small></div></div></div><div class="panel topic-panel"><div class="panel-header"><div><h3>Topic results</h3><p>Accuracy from published assignments</p></div><button class="text-button" data-action="topics">All topics ↗</button></div>${topicBar("Ch 6 · Atomic structure &amp; isotopes",84,"good")}${topicBar("Ch 6 · Electron configuration",76,"good")}${topicBar("Ch 9 · Shapes of molecules (VSEPR)",54,"low")}${topicBar("Ch 9 · Intermolecular forces",68,"mid")}<div class="topic-legend"><span><i class="good"></i>On track</span><span><i class="mid"></i>Building</span><span><i class="low"></i>Needs focus</span></div></div></div><div class="panel roster-panel"><div class="panel-header"><div><h3>Students who may need a hand</h3><p>Based on recent topic results. These describe learning, not the student.</p></div><button class="text-button" data-action="roster">View all 28 students ↗</button></div><div class="table-scroll"><table><thead><tr><th>STUDENT</th><th>TOPIC</th><th>LAST RESULT</th><th>LEARNING SIGNAL</th><th></th></tr></thead><tbody>${roster}</tbody></table></div></div>`;
}
function topicBar(name,pct,tone) { return `<div class="topic-row"><span>${name}</span><div class="progress-track"><i class="${tone}" style="width:${pct}%"></i></div><b>${pct}%</b></div>`; }
function renderLibrary() {
 const rows=state.resources.map((r,i)=>`<tr><td><div class="resource-name"><span class="resource-type">${r.type.slice(0,3)}</span><div><b>${r.name}</b><small>${r.date} · ${r.uses} uses</small></div></div></td><td>${r.topic}</td><td>${r.level}</td><td>${tag(r.status,r.status==='Approved'?'mint':'amber')}</td><td>${r.status==='Needs review'?`<button class="text-button" data-action="approve-resource" data-index="${i}">Review &amp; approve</button>`:`<span class="usage">${r.uses}×</span>`}</td></tr>`).join("");
 return `${topTitle("YOUR TEACHING MATERIALS", "Library", "Resources connected to your school, ready for your review.", `<button class="btn btn-secondary" data-action="drive-connect">▲ Google Drive folder</button><button class="btn btn-primary" data-action="connect-teams">＋ Connect materials</button>`)}<div class="library-stats"><div class="panel lib-stat"><span class="stat-icon lilac">▤</span><div><small>ALL MATERIALS</small><b>${state.resources.length}</b></div></div><div class="panel lib-stat"><span class="stat-icon mint">✓</span><div><small>APPROVED</small><b>${state.resources.filter(r=>r.status==='Approved').length}</b></div></div><div class="panel lib-stat"><span class="stat-icon peach">◷</span><div><small>NEEDS REVIEW</small><b>${state.resources.filter(r=>r.status==='Needs review').length}</b></div></div><div class="panel lib-stat"><span class="stat-icon blue">↗</span><div><small>CLASS USES</small><b>${state.resources.reduce((a,r)=>a+r.uses,0)}</b></div></div></div><div class="library-toolbar"><div class="search-field"><span>⌕</span><input id="resource-search" placeholder="Search materials" /></div><select id="topic-filter"><option value="">All topics</option><option>Ch 6 · Atomic theory</option><option>Ch 9 · Shapes of molecules</option><option>Ch 9 · Intermolecular forces</option><option>Course plan</option></select><select id="status-filter"><option value="">All statuses</option><option>Approved</option><option>Needs review</option></select><button class="filter-button">☷ Filters</button></div><div class="panel table-panel"><div class="table-scroll"><table><thead><tr><th>MATERIAL</th><th>TOPIC</th><th>LEVEL</th><th>STATUS</th><th>USAGE / ACTION</th></tr></thead><tbody id="resource-rows">${rows}</tbody></table></div><div class="table-foot">Showing ${state.resources.length} materials <span>Demo library · Sample data</span></div></div><div class="approval-rule"><span>▣</span><div><b>Only approved materials can reach students.</b><p>You decide which materials KBM can recommend. Review suggested topics and levels before approval.</p></div><button class="text-button" data-action="connect-teams">Connect a school folder →</button></div>`;
}
function renderAssignments() {
 const rows=state.tasks.map((t,i)=>`<article class="assignment-card"><div class="assignment-icon">${t.type==='Practice'?'✳':'▤'}</div><div class="assignment-body"><div class="assignment-title"><b>${t.title}</b>${tag(t.type,t.type==='Practice'?'mint':'purple')}</div><p>${t.className} <span>·</span> Due ${t.due}</p><div class="assignment-progress"><div class="progress-track"><i class="${t.submitted===t.total?'good':'mid'}" style="width:${Math.round(t.submitted/t.total*100)}%"></i></div><span>${t.submitted} of ${t.total} submitted</span>${t.review?`<span class="review-count">${t.review} to review</span>`:''}</div></div><button class="btn btn-secondary" data-action="review-task" data-index="${i}">${t.review?'Review work':'View task'} <span>→</span></button></article>`).join("");
 return `${topTitle("STUDENT WORK", "Assignments", "Review submissions and see how learning is progressing.", `<button class="btn btn-secondary" data-action="assignment-filter">☷ Filter</button>`)}<div class="assignment-summary"><div><span class="stat-icon lilac">☷</span><b>8</b><span>submitted work to review</span></div><div><span class="stat-icon mint">✓</span><b>63</b><span>completed this week</span></div><div><span class="stat-icon peach">◷</span><b>12</b><span>still in progress</span></div></div><div class="filter-tabs"><button class="filter-tab active" data-task-filter="all">All <span>3</span></button><button class="filter-tab" data-task-filter="review">Needs review <span>5</span></button><button class="filter-tab" data-task-filter="published">Published</button></div><div class="assignment-list">${rows}</div>`;
}
function renderSettings(user) { return `${topTitle("PREFERENCES & CONNECTIONS", "Settings", "Manage your school connections and workspace preferences.")}<div class="settings-layout"><div class="settings-nav"><button class="selected">Connections</button><button data-action="profile-settings">Profile</button><button data-action="notifications">Notifications</button></div><div class="settings-main"><div class="panel settings-panel"><div class="panel-header"><div><h2>School platforms</h2><p>Connect the tools your school already uses.</p></div></div><div class="connection-row"><div class="platform-logo teams-logo">T</div><div class="connection-copy"><b>Microsoft Teams</b><small>${user?`Connected as ${esc(user.email||user.name)}`:"Connect class files and shared materials from your school Teams."}</small></div>${user?`<span class="connected-label"><i></i> Connected</span><button class="btn btn-secondary" data-action="disconnect">Disconnect</button>`:`<button class="btn btn-primary" data-action="connect-teams">Connect Teams</button>`}</div><div class="connection-row"><div class="platform-logo class-logo">▣</div><div class="connection-copy"><b>Google Classroom</b><small>Sync classes, assignments and student submissions.</small></div><span class="tag neutral">Not connected</span><button class="btn btn-secondary" data-action="classroom">Connect</button></div><div class="connection-row"><div class="platform-logo drive-logo">▲</div><div class="connection-copy"><b>Google Drive</b><small>${driveLib?`Folder “${esc(driveLib.folder.name)}” · ${driveLib.files.length} files, ${driveLib.files.length-unassignedFiles(driveLib).length} linked to lessons`:"Choose a folder of lesson PDFs and link each file to a lesson."}</small></div>${driveLib?`<span class="connected-label"><i></i> Linked</span><button class="btn btn-secondary" data-action="drive-connect">Change folder</button><button class="btn btn-secondary" data-action="drive-disconnect">Disconnect</button>`:`<button class="btn btn-primary" data-action="drive-connect">Connect</button>`}</div></div><div class="panel settings-panel"><div class="panel-header"><div><h2>About the demo workspace</h2><p>Sample classroom data is shown so you can explore the teacher experience.</p></div>${tag("DEMO","amber")}</div><p class="settings-body">No student data is being imported. Connect a school account to begin linking your teaching materials. Any sample class, student and learning result shown in this workspace is illustrative.</p></div><div class="panel settings-panel"><div class="panel-header"><div><h2>Activity</h2><p>Recent changes to your teaching recommendations.</p></div></div><div class="activity-row"><span class="activity-icon">✧</span><span><b>Lesson suggestion prepared</b><small>Shapes of molecules (VSEPR) · 12A Chemistry · Today, 8:12 am</small></span></div><div class="activity-row"><span class="activity-icon">▤</span><span><b>Resource added to library</b><small>Intermolecular forces · boiling point trends · Yesterday, 3:46 pm</small></span></div></div></div></div>`; }
// ---------- Lessons: course plan + Google Drive files linked to each lesson ----------

const isPdf = (f) => f.mimeType === PDF || /\.pdf$/i.test(f.name);
function fileKind(f) {
  const m = f.mimeType || "", n = f.name.toLowerCase();
  if (isPdf(f)) return "PDF";
  if (/presentation|powerpoint/.test(m) || /\.pptx?$/.test(n)) return "SLI";
  if (/document|word/.test(m) || /\.docx?$/.test(n)) return "DOC";
  if (/spreadsheet|excel/.test(m) || /\.xlsx?$/.test(n)) return "XLS";
  if (m.startsWith("image/")) return "IMG";
  if (m.startsWith("video/")) return "VID";
  return "FILE";
}
function lessonOptions(selected) {
  return `<option value="">Not linked</option>${CHAPTERS.map((c) => `<optgroup label="Ch ${c.number} · ${esc(c.title)}"><option value="${c.id}" ${c.id === selected ? "selected" : ""}>Ch ${c.number} · whole chapter (all lessons)</option>${c.lessons.map((l) => `<option value="${l.id}" ${l.id === selected ? "selected" : ""}>${l.id} ${esc(l.title)}</option>`).join("")}</optgroup>`).join("")}`;
}
// One Drive file with Open / Preview, and either a remove button or a lesson dropdown.
function fileRow(f, { removable = false, assign = false } = {}) {
  const kind = fileKind(f);
  const whole = chapterById(driveLib?.map[f.id]);
  return `<div class="drive-file"><span class="resource-type ${kind === "PDF" ? "pdf-type" : ""}">${kind}</span><div class="drive-file-copy"><b>${esc(f.name)}</b><small>${whole && !assign ? `Whole chapter ${whole.number} · ` : ""}${esc(f.path || driveLib?.folder.name || "")}</small></div><div class="drive-file-actions">${assign ? `<select class="assign-select" data-assign="${esc(f.id)}" aria-label="Lesson for ${esc(f.name)}">${lessonOptions(driveLib.map[f.id])}</select>` : ""}${kind === "PDF" ? `<button class="btn btn-secondary" data-action="preview-file" data-file="${esc(f.id)}">Preview</button>` : ""}<a class="btn btn-primary" href="${esc(f.webViewLink)}" target="_blank" rel="noopener">Open${kind === "PDF" ? " PDF" : ""} ↗</a>${removable ? `<button class="remove-row" data-action="unassign-file" data-file="${esc(f.id)}" title="Unlink from this lesson">×</button>` : ""}</div></div>`;
}
// Drive files for a lesson, for embedding in other pages (Prepare).
function driveMaterials(lessonId) {
  const files = filesForLesson(driveLib, lessonId);
  if (!driveLib) return `<div class="drive-hint"><span>▲</span><p>Link a Google Drive folder to attach this lesson's PDF.</p><button class="text-button" data-action="drive-connect">Choose folder →</button></div>`;
  if (!files.length) return `<div class="drive-hint"><span>▲</span><p>No Drive file is linked to lesson ${lessonId} yet.</p><button class="text-button" data-action="open-lesson" data-lesson="${lessonId}">Link a file →</button></div>`;
  return `<div class="drive-group"><small>FROM GOOGLE DRIVE · LESSON ${lessonId}</small>${files.map((f) => fileRow(f)).join("")}</div>`;
}
function driveStatus() {
  if (!driveLib) return `<div class="panel drive-empty"><span class="platform-logo drive-logo">▲</span><div><h2>Link your Google Drive folder</h2><p>Choose the folder with your Cracking Chemistry PDFs. KBM reads the file list (read-only) and matches each file to a lesson by its name and folder. You can change any match.</p></div><button class="btn btn-primary" data-action="drive-connect">Choose Google Drive folder</button></div>`;
  const linked = driveLib.files.length - unassignedFiles(driveLib).length;
  return `<div class="panel drive-status"><span class="platform-logo drive-logo">▲</span><div class="connection-copy"><b>${esc(driveLib.folder.path || driveLib.folder.name)}</b><small>${driveLib.files.length} files · ${linked} linked to lessons · read ${new Date(driveLib.scannedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</small></div><button class="btn btn-secondary" data-action="drive-rescan">↻ Rescan</button><button class="btn btn-secondary" data-action="drive-connect">Change folder</button></div>`;
}
function renderLessons() {
  const chapters = CHAPTERS.map((c) => { const whole = chapterFiles(driveLib, c.id), wholePdf = whole.find(isPdf), busy = syncing === c.id;
    const source = c.source ? `<p class="plan-source">${c.source.manual ? "Lesson names edited by you" : `Lesson names from “${esc(c.source.name)}”`} · <button class="text-button" data-action="reset-chapter" data-chapter="${c.id}">Reset to defaults</button></p>` : "";
    return `<section class="panel chapter-panel"><div class="panel-header"><div><span class="eyebrow">CHAPTER ${c.number}</span><h2>${esc(c.title)}</h2>${source}</div><div class="chapter-actions">${tag(`${c.lessons.length} lessons`, "neutral")}${wholePdf ? `<button class="btn btn-secondary" data-action="sync-chapter" data-chapter="${c.id}" ${busy ? "disabled" : ""}>${busy ? "Reading PDF…" : "↻ Names from PDF"}</button>` : ""}<button class="btn btn-secondary" data-action="edit-chapter" data-chapter="${c.id}">✎ Edit names</button></div></div>${whole.length ? `<div class="drive-group"><small>WHOLE-CHAPTER FILES · SHOWN IN EVERY LESSON</small>${whole.map((f) => fileRow(f, { assign: true })).join("")}</div>` : ""}${c.lessons.map((l) => {
    const files = filesForLesson(driveLib, l.id).filter((f) => driveLib.map[f.id] === l.id), pdf = files.find(isPdf);
    return `<div class="lesson-row"><span class="lesson-code">${l.id}</span><div class="lesson-row-copy"><b>${esc(l.title)}</b><small>${files.length ? `${files.length} file${files.length > 1 ? "s" : ""} · ${esc(files.map((f) => f.name).join(", "))}` : whole.length ? "Chapter files only" : "No files linked"}</small></div>${pdf ? `<a class="btn btn-secondary" href="${esc(pdf.webViewLink)}" target="_blank" rel="noopener">Open PDF ↗</a>` : ""}<button class="btn btn-secondary" data-action="open-lesson" data-lesson="${l.id}">View lesson →</button></div>`;
  }).join("")}</section>`; }).join("");
  const loose = unassignedFiles(driveLib);
  const unassigned = loose.length ? `<section class="panel chapter-panel"><div class="panel-header"><div><span class="eyebrow">NEEDS A LESSON</span><h2>Files not linked to a lesson</h2><p>Pick the lesson each file belongs to. Files you leave as "Not linked" stay here.</p></div>${tag(`${loose.length} files`, "amber")}</div>${loose.map((f) => fileRow(f, { assign: true })).join("")}</section>` : "";
  return `${topTitle("COURSE PLAN · CRACKING CHEMISTRY", "Lessons", "Chapter 6 and Chapter 9, with the PDFs from your Google Drive folder linked to each lesson.")}${driveStatus()}<div class="lessons-grid">${chapters}${unassigned}</div>`;
}
function renderLesson() {
  // The lesson may no longer exist after its chapter's names were updated: fall back to that chapter's first lesson.
  const l = lessonById(state.lessonId) || CHAPTERS.find((c) => state.lessonId?.startsWith(`${c.number}.`))?.lessons.map((x) => lessonById(x.id))[0] || lessonById(SUGGESTED_LESSON) || lessonById(CHAPTERS[0].lessons[0].id);
  const files = filesForLesson(driveLib, l.id);
  const viewing = files.find((f) => f.id === state.viewFileId && isPdf(f)) || files.find(isPdf);
  const all = CHAPTERS.flatMap((c) => c.lessons), i = all.findIndex((x) => x.id === l.id), prev = all[i - 1], next = all[i + 1];
  const list = !driveLib
    ? `<div class="drive-hint"><span>▲</span><p>Link a Google Drive folder to attach PDFs to this lesson.</p><button class="text-button" data-action="drive-connect">Choose folder →</button></div>`
    : files.length ? files.map((f) => fileRow(f, { removable: true })).join("")
    : `<div class="drive-hint"><span>▲</span><p>No file from “${esc(driveLib.folder.name)}” is linked to this lesson yet.</p><button class="text-button" data-action="lesson-add-file">Link a file →</button></div>`;
  return `${topTitle(`CHAPTER ${l.chapter} · ${esc(l.chapterTitle.toUpperCase())}`, `${l.id} ${esc(l.title)}`, "Lesson materials from your Google Drive folder.", `<button class="btn btn-secondary" data-page="lessons">← All lessons</button>`)}<section class="panel lesson-panel"><div class="lesson-section-head"><div><h3>Lesson materials</h3><small>${files.length} file${files.length === 1 ? "" : "s"} from Google Drive</small></div>${driveLib ? `<button class="small-add" data-action="lesson-add-file">＋ Link file</button>` : ""}</div>${list}</section>${viewing ? `<section class="panel pdf-panel"><div class="lesson-section-head"><div><h3>${esc(viewing.name)}</h3><small>Preview from Google Drive</small></div><a class="text-button" href="${esc(viewing.webViewLink)}" target="_blank" rel="noopener">Open in Google Drive ↗</a></div><iframe class="pdf-frame" src="https://drive.google.com/file/d/${encodeURIComponent(viewing.id)}/preview" title="${esc(viewing.name)}" allow="autoplay"></iframe></section>` : ""}<div class="lesson-nav">${prev ? `<button class="btn btn-secondary" data-action="open-lesson" data-lesson="${prev.id}">← ${prev.id} ${esc(prev.title)}</button>` : "<span></span>"}${next ? `<button class="btn btn-secondary" data-action="open-lesson" data-lesson="${next.id}">${next.id} ${esc(next.title)} →</button>` : ""}</div>`;
}

// ---------- Google Drive folder picker ----------

let pick = null; // { stack: [{id,name,kind}], items, loading, error }
function closeModal() { $("#modal-root").innerHTML = ""; pick = null; }
async function openDrivePicker() {
  if (!drive) { toast("Google sign-in is not configured: add googleClientId to config.js."); return; }
  try { if (!drive.connected) await drive.connect(); } catch (e) { toast(e.message); return; }
  pick = { stack: [], items: null };
  loadPick(() => drive.roots());
}
async function loadPick(fn) {
  pick.loading = true; pick.error = null; drawPicker();
  try { pick.items = await fn(); } catch (e) { pick.error = e.message; }
  if (!pick) return; // closed while loading
  pick.loading = false; drawPicker();
}
function drawPicker() {
  if (!pick) return;
  const cur = pick.stack.at(-1), canUse = cur?.kind === "folder";
  const icon = { root: "▲", shared: "♙", drive: "▦", folder: "▰" };
  const crumbs = [`<button class="crumb-btn" data-crumb="-1">Google Drive</button>`, ...pick.stack.map((s, i) => `<button class="crumb-btn" data-crumb="${i}">${esc(s.name)}</button>`)].join(`<span class="crumb-sep">/</span>`);
  const list = pick.loading ? `<p class="folder-empty">Loading folders…</p>`
    : pick.error ? `<p class="folder-empty error-text">${esc(pick.error)}</p>`
    : !pick.items?.length ? `<p class="folder-empty">No subfolders here.${canUse ? " You can use this folder." : ""}</p>`
    : pick.items.map((f, i) => `<button class="folder-row" data-folder="${i}"><span class="folder-icon">${icon[f.kind]}</span><span>${esc(f.name)}</span><span class="folder-go">›</span></button>`).join("");
  $("#modal-root").innerHTML = `<div class="modal-backdrop" data-close><section class="modal modal-wide" role="dialog" aria-modal="true" aria-label="Choose a Google Drive folder"><button class="modal-close" data-close>×</button><div class="eyebrow">GOOGLE DRIVE · READ-ONLY</div><h2>Choose your lesson folder</h2><p class="modal-intro">Open the folder that holds your Cracking Chemistry PDFs, then click <b>Use this folder</b>. KBM reads the files in it and its subfolders; nothing in Drive is changed.</p><nav class="picker-crumbs">${crumbs}</nav><div class="folder-list">${list}</div><div class="modal-actions"><span class="picker-hint">${canUse ? `Selected: <b>${esc(cur.name)}</b>` : "Open a folder to select it"}</span><button class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary" data-use ${canUse && !pick.loading ? "" : "disabled"}>Use this folder</button></div></section></div>`;
  const root = $("#modal-root");
  root.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", (e) => { if (e.target === el) closeModal(); }));
  root.querySelectorAll("[data-crumb]").forEach((b) => b.addEventListener("click", () => {
    const i = +b.dataset.crumb;
    pick.stack = pick.stack.slice(0, i + 1);
    loadPick(() => (i < 0 ? drive.roots() : drive.folders(pick.stack.at(-1))));
  }));
  root.querySelectorAll("[data-folder]").forEach((b) => b.addEventListener("click", () => {
    const f = pick.items[+b.dataset.folder];
    pick.stack.push(f);
    loadPick(() => drive.folders(f));
  }));
  root.querySelector("[data-use]").addEventListener("click", () => {
    const folder = { id: cur.id, name: cur.name, path: pick.stack.map((s) => s.name).join(" / ") };
    closeModal();
    scanFolder(folder);
  });
}
async function scanFolder(folder) {
  toast(`Reading “${folder.name}” from Google Drive…`);
  try {
    const files = await drive.scan(folder.id);
    driveLib = buildLibrary(folder, files, driveLib);
    saveLibrary(driveLib);
    const linked = files.length - unassignedFiles(driveLib).length;
    if (state.page !== "lesson") go("lessons"); else render();
    toast(files.length ? `${files.length} files found · ${linked} matched to lessons.` : "That folder has no files.");
    await autoSyncChapters();
  } catch (e) { toast(e.message); }
}

// ---------- lesson names from a chapter PDF ----------

let syncing = null; // chapter id being read
// Read the numbered sections of a chapter PDF and use them as that chapter's lessons.
async function syncChapterFromPdf(chapterId, file) {
  const c = chapterById(chapterId);
  if (!c || !file || !drive || syncing) return false;
  syncing = chapterId; render();
  toast(`Reading lesson names from “${file.name}”…`);
  try {
    const sections = await extractSections(await drive.download(file.id), c.number);
    if (!sections.length) { toast(`No numbered sections (${c.number}.1, ${c.number}.2 …) found in “${file.name}”. Use Edit names to set them.`); return false; }
    setChapterLessons(chapterId, sections.map((s) => ({ id: `${c.number}.${s.n}`, title: s.title })), { fileId: file.id, name: file.name });
    // Lesson names changed, so re-match the files that weren't linked by hand.
    driveLib = buildLibrary(driveLib.folder, driveLib.files, driveLib);
    saveLibrary(driveLib);
    toast(`Chapter ${c.number}: ${sections.length} lesson names updated from “${file.name}”.`);
    return true;
  } catch (e) { toast(`Could not read “${file.name}”: ${e.message}`); return false; }
  finally { syncing = null; render(); }
}
// After a scan: chapters with a whole-chapter PDF that hasn't been read yet get their names from it.
async function autoSyncChapters() {
  for (const c of CHAPTERS) {
    const pdf = chapterFiles(driveLib, c.id).find(isPdf);
    if (pdf && !c.source?.manual && c.source?.fileId !== pdf.id) await syncChapterFromPdf(c.id, pdf);
  }
}
function editChapterModal(chapterId) {
  const c = chapterById(chapterId);
  const text = c.lessons.map((l) => `${l.id} ${l.title}`).join("\n");
  $("#modal-root").innerHTML = `<div class="modal-backdrop" data-close><section class="modal" role="dialog" aria-modal="true" aria-label="Edit lesson names"><button class="modal-close" data-close>×</button><div class="eyebrow">CHAPTER ${c.number} · ${esc(c.title.toUpperCase())}</div><h2>Edit lesson names</h2><p class="modal-intro">One lesson per line, starting with its number, e.g. <b>${c.number}.1 ${esc(c.lessons[0]?.title || "Lesson name")}</b>. Add or remove lines to change the number of lessons.</p><label class="feedback-label">Lessons<textarea id="lesson-names" rows="8" spellcheck="false">${esc(text)}</textarea></label><p class="modal-error" id="lesson-names-error" hidden></p><div class="modal-actions"><button class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary" data-save>Save names</button></div></section></div>`;
  const root = $("#modal-root");
  root.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", (e) => { if (e.target === el) closeModal(); }));
  root.querySelector("[data-save]").addEventListener("click", () => {
    const seen = new Set(), lessons = [];
    for (const raw of $("#lesson-names").value.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      const m = line.match(/^(\d{1,2})\s*\.\s*(\d{1,2})\s*[:.)\-–—]?\s+(.+)$/);
      if (!m || +m[1] !== c.number) return showError(`“${line}” should start with ${c.number}.1, ${c.number}.2 …`);
      const id = `${+m[1]}.${+m[2]}`;
      if (seen.has(id)) return showError(`${id} appears twice.`);
      seen.add(id); lessons.push({ id, title: m[3].trim() });
    }
    if (!lessons.length) return showError("Add at least one lesson.");
    lessons.sort((a, b) => +a.id.split(".")[1] - +b.id.split(".")[1]);
    setChapterLessons(chapterId, lessons, { manual: true });
    if (driveLib) { driveLib = buildLibrary(driveLib.folder, driveLib.files, driveLib); saveLibrary(driveLib); }
    closeModal(); render(); toast(`Chapter ${c.number} lesson names saved.`);
  });
  function showError(msg) { const e = $("#lesson-names-error"); e.textContent = msg; e.hidden = false; }
}
function previewFile(id) {
  const f = driveLib?.files.find((x) => x.id === id);
  if (!f) return;
  if (state.page === "lesson") { state.viewFileId = id; render(); $(".pdf-panel")?.scrollIntoView({ behavior: "smooth" }); return; }
  $("#modal-root").innerHTML = `<div class="modal-backdrop" data-close><section class="modal modal-wide" role="dialog" aria-modal="true" aria-label="${esc(f.name)}"><button class="modal-close" data-close>×</button><div class="eyebrow">GOOGLE DRIVE</div><h2>${esc(f.name)}</h2><iframe class="pdf-frame" src="https://drive.google.com/file/d/${encodeURIComponent(f.id)}/preview" title="${esc(f.name)}"></iframe><div class="modal-actions"><a class="btn btn-secondary" href="${esc(f.webViewLink)}" target="_blank" rel="noopener">Open in Google Drive ↗</a><button class="btn btn-primary" data-close>Close</button></div></section></div>`;
  $("#modal-root").querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", (e) => { if (e.target === el) closeModal(); }));
}
function linkFileModal(lessonId) {
  if (!driveLib) return openDrivePicker();
  const l = lessonById(lessonId);
  const files = driveLib.files.filter((f) => driveLib.map[f.id] !== lessonId).sort((a, b) => isPdf(b) - isPdf(a) || a.name.localeCompare(b.name));
  const rows = files.length ? files.map((f) => `<label><input type="checkbox" value="${esc(f.id)}"> <span class="resource-type ${isPdf(f) ? "pdf-type" : ""}">${fileKind(f)}</span> <span class="link-name">${esc(f.name)}</span><small>${isTarget(driveLib.map[f.id]) ? `Now: ${esc(targetLabel(driveLib.map[f.id]))}` : "Not linked"}</small></label>`).join("") : `<p class="folder-empty">Every file in this folder is already linked to this lesson.</p>`;
  $("#modal-root").innerHTML = `<div class="modal-backdrop" data-close><section class="modal modal-wide" role="dialog" aria-modal="true" aria-label="Link files to lesson"><button class="modal-close" data-close>×</button><div class="eyebrow">LESSON ${l.id}</div><h2>Link files to “${esc(l.title)}”</h2><p class="modal-intro">From “${esc(driveLib.folder.name)}”. A file belongs to one lesson; linking it here moves it from its current lesson.</p><div class="select-resource link-list">${rows}</div><div class="modal-actions"><button class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary" data-link>Link selected</button></div></section></div>`;
  const root = $("#modal-root");
  root.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", (e) => { if (e.target === el) closeModal(); }));
  root.querySelector("[data-link]").addEventListener("click", () => {
    const ids = [...root.querySelectorAll("input:checked")].map((c) => c.value);
    ids.forEach((id) => setLink(driveLib, id, lessonId));
    saveLibrary(driveLib); closeModal(); render();
    if (ids.length) toast(`${ids.length} file${ids.length > 1 ? "s" : ""} linked to lesson ${lessonId}.`);
  });
}

function render() {
 const pageNames={teaching:"Teaching",prepare:"Prepare",lessons:"Lessons",lesson:"Lessons",classes:"Classes",library:"Library",assignments:"Assignments",settings:"Settings"};
 $("#crumb-current").textContent=pageNames[state.page]; document.title=`KBM · ${pageNames[state.page]}`;
 document.querySelectorAll(".nav-item[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===state.page||(state.page==="lesson"&&b.dataset.page==="lessons")));
 const user=window.kbmUser||null;
 $("#page-content").innerHTML=({teaching:renderTeaching,prepare:renderPrepare,lessons:renderLessons,lesson:renderLesson,classes:renderClasses,library:renderLibrary,assignments:renderAssignments,settings:()=>renderSettings(user)})[state.page]();
 bind();
}
function go(page){state.page=page;$("#sidebar").classList.remove("mobile-open");render();window.scrollTo({top:0,behavior:"smooth"});}
function toast(message){const t=$("#toast");t.textContent=message;t.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.hidden=true,3200);}
function modal(title,body,actions=""){const root=$("#modal-root");root.innerHTML=`<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><button class="modal-close" data-action="close-modal">×</button><div class="eyebrow">TEACHER WORKSPACE</div><h2>${title}</h2>${body}<div class="modal-actions">${actions}<button class="btn btn-secondary" data-action="close-modal">Close</button></div></section></div>`;$(".modal",root).addEventListener("click",e=>e.stopPropagation());root.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const a=b.dataset.action;if(a==='close-modal')root.innerHTML='';else if(a==='confirm-publish')publish();else if(a==='add-question-confirm'){toast('Question added to your lesson.');root.innerHTML='';}else if(a==='confirm-review'){const box=$('.modal',root);box.innerHTML=`<button class="modal-close" data-action="close-modal">×</button><div class="success-icon modal-success">✓</div><h2>Review confirmed</h2><p class="modal-intro">Student progress and class topic results have been updated.</p><div class="modal-actions"><button class="btn btn-secondary" data-action="close-modal">Done</button></div>`;box.querySelectorAll('[data-action="close-modal"]').forEach(x=>x.addEventListener('click',()=>root.innerHTML=''));}else if(a==='return-work')toast('Feedback saved. Student can retry this task.');}));}
function publish(){state.published=true;state.prepared=false;go("teaching");toast("Lesson approved and published to students.");}
async function connectTeams(){if(!graph){go("settings");toast("Teams sign-in is not configured yet. Add your app clientId in config.js to connect your school account.");return;}try{sessionStorage.setItem("kbm.connectAfterSignIn","1");await graph.signIn();}catch(e){const message=friendlyError(e);if(message)toast(message);}}
function bind(){
 document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.page)));
 document.querySelectorAll("[data-action]").forEach(b=>b.addEventListener("click",async()=>{const a=b.dataset.action;
  if(a==="why") modal("Why this lesson?",`<p class="modal-intro">This suggestion uses recent, class-level learning results to identify what may help next.</p><div class="why-list"><div><b>54% topic accuracy</b><span>Shapes of molecules (VSEPR) across the last two published assignments.</span></div><div><b>8 students need another example</b><span>Most predicted shapes from bonding pairs only and ignored lone pairs (e.g. NH₃, H₂O).</span></div><div><b>2 days since the last chemistry lesson</b><span>Students last worked on Chapter 6 · electron configuration.</span></div></div>`);
  else if(a==="approve") modal("Approve and publish?",`<p class="modal-intro">This lesson will be sent to <b>28 students in 12A Chemistry</b>. Students will see the materials and tasks listed in your lesson plan.</p><div class="confirm-summary"><span>Lesson</span><b>Shapes of molecules (VSEPR) · Today</b><span>Homework</span><b>Shapes of molecules · exit ticket</b><span>Extra practice</span><b>2 students</b></div>`,`<button class="btn btn-primary" data-action="confirm-publish">Approve &amp; publish →</button>`);
  else if(a==="confirm-publish") publish();
  else if(a==="edit-plan") go("prepare");
  else if(a==="prepare") go("prepare");
  else if(a==="save-plan"){state.prepared=true;toast("Draft saved.");}
  else if(a==="open-class"){state.selectedClass=b.dataset.class||"12A Chemistry";go("classes");}
  else if(a==="approve-resource"){state.resources[+b.dataset.index].status="Approved";render();toast("Resource approved. It can now be recommended in lessons.");}
  else if(a==="connect-teams") connectTeams();
  else if(a==="drive-connect") openDrivePicker();
  else if(a==="drive-rescan"){if(driveLib)scanFolder(driveLib.folder);else openDrivePicker();}
  else if(a==="drive-disconnect"){drive?.disconnect();driveLib=null;saveLibrary(null);render();toast("Google Drive folder unlinked from KBM.");}
  else if(a==="open-lesson"){state.lessonId=b.dataset.lesson;state.viewFileId=null;go("lesson");}
  else if(a==="lesson-add-file") linkFileModal(state.lessonId);
  else if(a==="sync-chapter") syncChapterFromPdf(b.dataset.chapter, chapterFiles(driveLib,b.dataset.chapter).find(isPdf));
  else if(a==="edit-chapter") editChapterModal(b.dataset.chapter);
  else if(a==="reset-chapter"){resetChapter(b.dataset.chapter);if(driveLib){driveLib=buildLibrary(driveLib.folder,driveLib.files,driveLib);saveLibrary(driveLib);}render();toast("Lesson names reset to the Cracking Chemistry defaults.");}
  else if(a==="preview-file") previewFile(b.dataset.file);
  else if(a==="unassign-file"){setLink(driveLib,b.dataset.file,"");saveLibrary(driveLib);render();toast("File unlinked. It is listed under Lessons → Files not linked.");}
  else if(a==="disconnect"){try{await graph?.signOut();}catch(e){toast(friendlyError(e)||"Could not disconnect.");}}
  else if(a==="review-task"){const task=state.tasks[+b.dataset.index];modal("Review student work",`<p class="modal-intro"><b>${esc(task.title)}</b><br>${esc(task.className)} · ${esc(task.submitted)} of ${esc(task.total)} submitted</p><div class="submission-review"><div class="student-mini"><div class="avatar small-avatar">AH</div><span><b>Amelia Hart</b><small>Submitted today at 8:42 am · 4/8 correct</small></span>${tag("Needs review","amber")}</div><div class="answer-box"><small>QUESTION 4 · PREDICT THE SHAPE AND BOND ANGLE OF NH₃</small><b>Trigonal planar, 120°</b><p>Count all the electron pairs around nitrogen, including the lone pair. Four electron pairs (3 bonding + 1 lone) give a trigonal pyramidal shape, and the lone pair pushes the bonds closer together (about 107°).</p></div><label class="feedback-label">Feedback<textarea rows="2" placeholder="Add a short note to the student"></textarea></label></div>`,`<button class="btn btn-secondary" data-action="return-work">↶ Return for another try</button><button class="btn btn-primary" data-action="confirm-review">Confirm review ✓</button>`);}
  else if(a==="confirm-review"){document.querySelector(".modal").innerHTML=`<button class="modal-close" data-action="close-modal">×</button><div class="success-icon modal-success">✓</div><h2>Review confirmed</h2><p class="modal-intro">Student progress and class topic results have been updated.</p><div class="modal-actions"><button class="btn btn-secondary" data-action="close-modal">Done</button></div>`;}
  else if(a==="return-work")toast("Feedback saved. Student can retry this task.");
  else if(a==="add-resource")modal("Add lesson material",`<p class="modal-intro">Only approved resources from your school library can be added to a lesson.</p><div class="select-resource"><label><input type="checkbox" checked> Bond angles &amp; lone pairs practice <small>Worksheet · Approved</small></label><label><input type="checkbox"> Atomic theory · electron configuration <small>Slides · Approved</small></label></div>`);
  else if(a==="add-question")modal("Add a class question",`<label class="feedback-label">Question<textarea rows="3" placeholder="Write a question"></textarea></label><label class="feedback-label">Topic<select><option>Ch 9 · Shapes of molecules</option><option>Ch 9 · Intermolecular forces</option><option>Ch 6 · Atomic theory</option></select></label>`,`<button class="btn btn-primary" data-action="add-question-confirm">Add question</button>`);
  else if(a==="add-question-confirm"){toast("Question added to your lesson.");document.querySelector("#modal-root").innerHTML="";}
  else if(a==="close-modal"){if(b.classList.contains("modal-backdrop")||b.classList.contains("modal-close")||b.closest(".modal-actions"))$("#modal-root").innerHTML="";}
  else if(a==="schedule")toast("Class setup will be available when you connect your school account.");
  else if(a==="topics"||a==="roster")toast("Class detail is shown using sample demo data.");
  else if(a==="assignment-filter")toast("Showing current assignments.");
  else if(a==="classroom")toast("Google Classroom connection is coming soon.");
  else if(a==="profile-settings"||a==="notifications")toast("This preference is not available in the demo yet.");
 }));
 document.querySelectorAll("[data-assign]").forEach(s=>s.addEventListener("change",()=>{setLink(driveLib,s.dataset.assign,s.value);saveLibrary(driveLib);render();toast(s.value?`Linked to ${targetLabel(s.value)}.`:"File unlinked.");
  // Choosing a PDF as the whole-chapter file updates that chapter's lesson names from it.
  const f=driveLib.files.find(x=>x.id===s.dataset.assign);if(chapterById(s.value)&&f&&isPdf(f))syncChapterFromPdf(s.value,f);}));
 document.querySelectorAll("[data-class-tab]").forEach(b=>b.addEventListener("click",()=>{state.selectedClass=b.dataset.classTab;render();}));
 document.querySelectorAll("[data-task-filter]").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("[data-task-filter]").forEach(x=>x.classList.toggle("active",x===b));toast(b.dataset.taskFilter==="review"?"Showing submissions to review.":"Assignment list updated.");}));
 document.querySelectorAll(".remove-row").forEach(b=>b.addEventListener("click",()=>{b.closest(".editable-row,.question-row")?.remove();}));
 const search=$("#resource-search"); if(search) search.addEventListener("input",filterResources);
 [$("#topic-filter"),$("#status-filter")].filter(Boolean).forEach(e=>e.addEventListener("change",filterResources));
}
function filterResources(){const q=$("#resource-search")?.value.toLowerCase()||"",topic=$("#topic-filter")?.value||"",status=$("#status-filter")?.value||"";document.querySelectorAll("#resource-rows tr").forEach((tr,i)=>{const r=state.resources[i];tr.hidden=!(r&&r.name.toLowerCase().includes(q)&&(!topic||r.topic===topic)&&(!status||r.status===status));});}
document.querySelectorAll(".main-nav [data-page], .sidebar [data-page]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.page)));
$("#mobile-menu").addEventListener("click",()=>$("#sidebar").classList.toggle("mobile-open"));
$("#banner-connect").addEventListener("click",connectTeams);
const d=new Date();$("#today-date").textContent=d.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"});
if(graph){graph.restore().then(user=>{window.kbmUser=user;if(user){$(".demo-banner").innerHTML=`<span class="connected-banner-icon">✓</span><b>School account connected</b><span>Signed in as ${esc(user.email||user.name)}. Sample class data remains clearly marked until connected sources are added.</span>`;$("#banner-connect").remove();}render();}).catch(e=>{const message=friendlyError(e);if(message)toast(message);});}
render();
