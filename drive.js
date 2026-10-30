// Google Drive read-only access via Google Identity Services. The access token stays in memory.
const API = "https://www.googleapis.com/drive/v3";
const SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const FOLDER = "application/vnd.google-apps.folder";
const MAX_DEPTH = 3, MAX_FILES = 500;

export function createDriveClient(config) {
  if (!config?.googleClientId) return null;
  let client, token = null, expiry = 0, pending = null;

  function authorize(prompt) {
    if (!window.google?.accounts?.oauth2) throw new Error("Google sign-in has not loaded. Refresh and try again.");
    return new Promise((resolve, reject) => {
      pending = { resolve, reject };
      client ||= window.google.accounts.oauth2.initTokenClient({
        client_id: config.googleClientId,
        scope: SCOPE,
        callback: (r) => {
          const p = pending; pending = null;
          if (r.error) return p?.reject(new Error(r.error_description || r.error));
          if (!window.google.accounts.oauth2.hasGrantedAllScopes(r, SCOPE)) return p?.reject(new Error("Google Drive access was not granted. Tick the Drive permission and try again."));
          token = r.access_token; expiry = Date.now() + Number(r.expires_in || 3600) * 1000; p?.resolve(token);
        },
        error_callback: (e) => { const p = pending; pending = null; p?.reject(new Error(e.type === "popup_closed" ? "Google sign-in was closed." : e.message || "Google sign-in failed.")); },
      });
      client.requestAccessToken({ prompt });
    });
  }

  // Reuses a live token; otherwise asks Google again (no consent screen if already granted).
  async function ensureToken() {
    if (token && expiry > Date.now() + 60000) return token;
    return authorize("");
  }

  async function get(path, params) {
    await ensureToken();
    const url = `${API}${path}?${new URLSearchParams(params)}`;
    const r = await fetch(url, { headers: { Authorization: "Bearer " + token } });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 401) token = null;
      if (r.status === 403 && /has not been used|is disabled/i.test(body.error?.message || ""))
        throw new Error("The Google Drive API is not enabled for this app. Enable it in Google Cloud Console → APIs & Services.");
      throw new Error(body.error?.message || `Google Drive request failed (${r.status}).`);
    }
    return body;
  }

  async function listAll(q, fields, corpora = "allDrives") {
    const out = [];
    let pageToken;
    do {
      const page = await get("/files", {
        q, fields: `nextPageToken, files(${fields})`, orderBy: "folder,name", pageSize: "200",
        supportsAllDrives: "true", includeItemsFromAllDrives: "true", corpora,
        ...(pageToken ? { pageToken } : {}),
      });
      out.push(...(page.files || []));
      pageToken = page.nextPageToken;
    } while (pageToken);
    return out;
  }

  const esc = (id) => id.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

  return {
    get connected() { return !!token && expiry > Date.now(); },
    async connect() { await authorize("consent select_account"); },
    disconnect() { if (token) window.google?.accounts?.oauth2?.revoke(token, () => {}); token = null; expiry = 0; },

    // Top-level places to start browsing.
    async roots() {
      const drives = await get("/drives", { pageSize: "100", fields: "drives(id,name)" }).catch(() => ({ drives: [] }));
      return [
        { id: "root", name: "My Drive", kind: "root" },
        { id: "shared", name: "Shared with me", kind: "shared" },
        ...(drives.drives || []).map((d) => ({ id: d.id, name: d.name, kind: "drive" })),
      ];
    },

    async folders(parent) {
      const list = parent.kind === "shared"
        ? await listAll(`sharedWithMe and mimeType='${FOLDER}' and trashed=false`, "id,name", "user")
        : await listAll(`'${esc(parent.id)}' in parents and mimeType='${FOLDER}' and trashed=false`, "id,name");
      return list.map((f) => ({ id: f.id, name: f.name, kind: "folder" }));
    },

    // File contents (e.g. a chapter PDF) as an ArrayBuffer.
    async download(fileId, maxBytes = 80 * 1024 * 1024) {
      await ensureToken();
      const r = await fetch(`${API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, { headers: { Authorization: "Bearer " + token } });
      if (!r.ok) { if (r.status === 401) token = null; throw new Error(`Could not download the file from Google Drive (${r.status}).`); }
      if (+r.headers.get("content-length") > maxBytes) throw new Error("This PDF is too large to read in the browser.");
      return r.arrayBuffer();
    },

    // All files in a folder and its subfolders (up to MAX_DEPTH levels), with their relative path.
    async scan(folderId) {
      const files = [];
      async function walk(id, path, depth) {
        const items = await listAll(`'${esc(id)}' in parents and trashed=false`, "id,name,mimeType,webViewLink,modifiedTime,size");
        for (const it of items) {
          if (files.length >= MAX_FILES) return;
          if (it.mimeType === FOLDER) {
            if (depth < MAX_DEPTH) await walk(it.id, path ? `${path} / ${it.name}` : it.name, depth + 1);
          } else {
            files.push({ id: it.id, name: it.name, mimeType: it.mimeType, webViewLink: it.webViewLink, modifiedTime: it.modifiedTime, path });
          }
        }
      }
      await walk(folderId, "", 1);
      return files;
    },
  };
}
