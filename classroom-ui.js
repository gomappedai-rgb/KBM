import { createClassroomClient } from "./classroom.js";
const client = createClassroomClient(window.APP_CONFIG);
let data = null, busy = false;
function updateRow() {
  const row = document.querySelector(".class-logo")?.closest(".connection-row");
  if (!row) return;
  const small = row.querySelector(".connection-copy small");
  if (small) small.textContent = data ? "Connected as " + (data.email || "Google account") + " · " + data.courses.length + " classes, " + data.assignments + " assignments, " + data.submissions + " submissions" : "Sync classes, assignments and student submissions from Google Classroom.";
  row.querySelectorAll("button[data-action], .connected-label, .tag").forEach(node => node.remove());
  if (data) {
    const status = document.createElement("span"); status.className = "connected-label"; status.innerHTML = "<i></i> Connected"; row.append(status);
    const sync = document.createElement("button"); sync.className = "btn btn-secondary"; sync.dataset.action = "classroom-sync"; sync.textContent = busy ? "Syncing…" : "Sync now"; sync.disabled = busy; row.append(sync);
    const disconnect = document.createElement("button"); disconnect.className = "btn btn-secondary"; disconnect.dataset.action = "classroom-disconnect"; disconnect.textContent = "Disconnect"; disconnect.disabled = busy; row.append(disconnect);
  } else {
    const status = document.createElement("span"); status.className = "tag neutral"; status.textContent = client ? "Not connected" : "Setup required"; row.append(status);
    const connect = document.createElement("button"); connect.className = "btn btn-primary"; connect.dataset.action = "classroom"; connect.textContent = client ? "Connect" : "Setup"; row.append(connect);
  }
}
document.addEventListener("click", async event => {
  const button = event.target.closest('[data-action="classroom"], [data-action="classroom-sync"], [data-action="classroom-disconnect"]');
  if (!button) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (busy) return;
  const action = button.dataset.action;
  if (action === "classroom-disconnect") { client?.disconnect(); data = null; updateRow(); return; }
  try {
    busy = true; updateRow();
    data = action === "classroom" ? await client.connect() : await client.sync();
  } catch (error) {
    const message = error?.message || String(error);
    alert(/403|permission|access/i.test(message) ? "Google denied access. Check that the Classroom API is enabled, the OAuth scopes are allowed, and this teacher account can use the app." : message);
  } finally { busy = false; updateRow(); }
}, true);
const pageContent = document.getElementById("page-content");
new MutationObserver(updateRow).observe(pageContent || document.body, {childList:true});
