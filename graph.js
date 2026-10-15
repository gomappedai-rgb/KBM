// Microsoft sign-in (MSAL) + the few Graph calls the app needs.

const GRAPH = "https://graph.microsoft.com/v1.0";
const enc = encodeURIComponent;

// Returns null when config.js has no clientId (app not registered yet).
export function createGraphClient(config) {
  return config.clientId ? createMsalClient(config) : null;
}

// Turns Entra/Graph errors into something a teacher can act on.
export function friendlyError(e) {
  const msg = `${e?.errorCode || ""} ${e?.errorMessage || e?.message || String(e)}`.trim();
  if (/user_cancelled|access_denied/.test(msg)) return null;
  if (/AADSTS65001|AADSTS90094|admin approval|consent/i.test(msg))
    return "Your school needs to approve this app first. Ask IT to grant admin consent for Teacher Hub in Microsoft Entra.";
  if (/AADSTS50011/.test(msg))
    return `Redirect URI mismatch. In the app registration, add a Single-page application redirect URI: ${REDIRECT_URI}`;
  if (/AADSTS700016|AADSTS90002/.test(msg))
    return "This app isn't registered with your school's Microsoft 365. Check clientId and tenantId in config.js.";
  return e?.errorMessage || e?.message || msg;
}

// Must match the SPA redirect URI in the app registration exactly.
// Include the current static-site path so this works both at localhost root and
// under GitHub Pages project URLs such as /KBM/.
export const REDIRECT_URI = `${location.origin}${location.pathname}`;

function createMsalClient(config) {
  // Redirect (not popup) sign-in: popups are often blocked in school browsers and Teams.
  const redirectUri = REDIRECT_URI;
  const msalApp = new msal.PublicClientApplication({
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${config.tenantId || "organizations"}`,
      redirectUri,
      postLogoutRedirectUri: redirectUri,
      navigateToLoginRequestUrl: false,
    },
    cache: { cacheLocation: "localStorage" },
  });
  const ready = msalApp.initialize();
  let account = null;

  async function token() {
    await ready;
    const req = { scopes: config.scopes, account, redirectUri };
    try {
      return (await msalApp.acquireTokenSilent(req)).accessToken;
    } catch (e) {
      if (e instanceof msal.InteractionRequiredAuthError) {
        await msalApp.acquireTokenRedirect(req); // navigates away; the app resumes on return
        return new Promise(() => {});
      }
      throw e;
    }
  }

  async function get(pathOrUrl) {
    const url = pathOrUrl.startsWith("https://") ? pathOrUrl : GRAPH + pathOrUrl;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${await token()}` } });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) throw new Error("You don't have access to this in Teams.");
      throw new Error(body.error?.message || `Graph request failed (${res.status})`);
    }
    return res.json();
  }

  // Follows @odata.nextLink so large Teams/folders aren't cut off.
  async function getAll(path) {
    const out = [];
    for (let next = path; next; ) {
      const page = await get(next);
      out.push(...page.value);
      next = page["@odata.nextLink"];
    }
    return out;
  }

  const toUser = (a) => ({ name: a.name, email: a.username });

  return {
    demo: false,
    // Completes a sign-in redirect if we're returning from Microsoft, else reuses the cached account.
    async restore() {
      await ready;
      const result = await msalApp.handleRedirectPromise();
      account = result?.account || msalApp.getAllAccounts()[0] || null;
      return account && toUser(account);
    },
    async signIn() {
      await ready;
      await msalApp.loginRedirect({ scopes: config.scopes, redirectUri, prompt: "select_account" });
      return new Promise(() => {}); // page is navigating to Microsoft
    },
    async signOut() {
      await ready;
      await msalApp.logoutRedirect({ account, postLogoutRedirectUri: redirectUri });
    },
    async listTeams() {
      const teams = await getAll("/me/joinedTeams?$select=id,displayName,description");
      return teams.sort((a, b) => a.displayName.localeCompare(b.displayName));
    },
    async listChannels(teamId) {
      return getAll(`/teams/${enc(teamId)}/channels?$select=id,displayName,membershipType`);
    },
    // Root of a channel's "Files" tab (a SharePoint folder).
    async channelFolder(teamId, channelId) {
      const f = await get(`/teams/${enc(teamId)}/channels/${enc(channelId)}/filesFolder`);
      return { driveId: f.parentReference.driveId, id: f.id, name: f.name };
    },
    async listChildren(driveId, itemId) {
      const items = await getAll(
        `/drives/${enc(driveId)}/items/${enc(itemId)}/children?$select=id,name,folder,file,webUrl,lastModifiedDateTime&$top=200`
      );
      return items.map((i) => ({
        id: i.id,
        name: i.name,
        isFolder: !!i.folder,
        webUrl: i.webUrl,
        modified: i.lastModifiedDateTime,
      }));
    },
  };
}
