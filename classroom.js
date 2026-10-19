// Google Classroom read-only OAuth. Tokens and fetched student details stay in memory only.
const API = "https://classroom.googleapis.com/v1";
const SCOPES = ["openid", "email", "profile", "https://www.googleapis.com/auth/classroom.courses.readonly", "https://www.googleapis.com/auth/classroom.coursework.students.readonly"].join(" ");
export function createClassroomClient(config) {
  if (!config?.googleClientId) return null;
  let client, token = null, expiry = 0;
  function authorize(prompt) {
    if (!window.google?.accounts?.oauth2) throw new Error("Google sign-in has not loaded. Refresh and try again.");
    return new Promise((resolve, reject) => {
      client ||= window.google.accounts.oauth2.initTokenClient({
        client_id: config.googleClientId, scope: SCOPES,
        callback: r => { if (r.error) return reject(new Error(r.error_description || r.error)); token = r.access_token; expiry = Date.now() + Number(r.expires_in || 3600) * 1000; resolve(token); },
        error_callback: e => reject(new Error(e.message || "Google sign-in was closed.")),
      });
      client.requestAccessToken({ prompt });
    });
  }
  async function get(url) {
    const r = await fetch(url, { headers: { Authorization: "Bearer " + token } });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) { if (r.status === 401) token = null; throw new Error(body.error?.message || "Google Classroom request failed (" + r.status + ")."); }
    return body;
  }
  async function list(path, key) {
    let next = API + path, all = [];
    while (next) { const page = await get(next); all.push(...(page[key] || [])); next = page.nextPageToken ? API + path + (path.includes("?") ? "&" : "?") + "pageToken=" + encodeURIComponent(page.nextPageToken) : null; }
    return all;
  }
  async function sync() {
    if (!token || expiry < Date.now() + 60000) throw new Error("Google connection expired. Reconnect Google Classroom.");
    const profile = await get("https://www.googleapis.com/oauth2/v3/userinfo");
    const courses = await list("/courses?teacherId=me&courseStates=ACTIVE&pageSize=100", "courses"), summary = [];
    for (const c of courses) {
      const id = encodeURIComponent(c.id), work = await list("/courses/" + id + "/courseWork?pageSize=100", "courseWork");
      const submissions = work.length ? await list("/courses/" + id + "/courseWork/-/studentSubmissions?pageSize=100", "studentSubmissions") : [];
      summary.push({ name: c.name || "Untitled class", assignments: work.length, submissions: submissions.length });
    }
    return { email: profile.email || "", courses: summary, assignments: summary.reduce((n, c) => n + c.assignments, 0), submissions: summary.reduce((n, c) => n + c.submissions, 0) };
  }
  return { async connect() { await authorize("consent select_account"); return sync(); }, sync, disconnect() { if (token) window.google.accounts.oauth2.revoke(token, () => {}); token = null; expiry = 0; } };
}
