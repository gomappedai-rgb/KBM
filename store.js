// Saved links, kept in the browser. Keys: "coursePlan" (step 1),
// "materials" (step 2, coming next).

const KEY = "teacherHub.links";

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export function getLink(name) {
  return readAll()[name] || null;
}

export function setLink(name, value) {
  const all = readAll();
  if (value) all[name] = value;
  else delete all[name];
  localStorage.setItem(KEY, JSON.stringify(all));
}
