# KBM Teacher Workspace

A no-build teacher workspace prototype based on the KBM feature map. It includes Teaching, Prepare, Classes, Library, Assignments and Settings views. Sample classes, student results, resources and submissions are clearly marked as demo data and remain in the browser only.

## Run it

```powershell
powershell -ExecutionPolicy Bypass -File .\serve.ps1
```

Open http://localhost:8080. The workspace is usable without an account so the teacher flow can be explored. The Microsoft Teams sign-in uses the configured app registration below.

## Publish with GitHub Pages

The repository includes a GitHub Actions workflow that deploys this static app whenever `main` changes. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**. Once the first deployment succeeds, the site will be at https://gomappedai-rgb.github.io/KBM/.

If you enable Microsoft sign-in, add `https://gomappedai-rgb.github.io/KBM/` as a Single-page application redirect URI in the Entra app registration. The sample workspace itself runs without sign-in.

## Connect Microsoft Teams

1. In Microsoft Entra, register a single-page app with redirect URI `http://localhost:8080/`.
2. Add delegated Microsoft Graph permissions: `User.Read`, `Team.ReadBasic.All`, `Channel.ReadBasic.All`, and `Files.Read.All`.
3. Put the app's client ID and tenant ID in `config.js`.
4. Run the local server and connect from Settings.

Without a client ID, the Connect account actions explain the setup requirement. Data shown in the teacher workspace is illustrative, not connected to a school's records.

## Google Drive lesson files

**Lessons** (sidebar) lists the course plan: Cracking Chemistry Chapter 6 (Atomic Theory, 6.1–6.5) and Chapter 9 (Shapes of Molecules & Intermolecular Forces, 9.1–9.4), defined in `lessons.js`.

1. Click **Choose Google Drive folder** (on Lessons, Library or Settings). Sign in with Google and allow read-only Drive access.
2. Browse My Drive, Shared with me or a shared drive, open the folder with the lesson PDFs, and click **Use this folder**.
3. KBM reads the files in that folder and up to three levels of subfolders. It matches each one to a lesson using:
   - **Lesson codes** such as `6.4` or `9-3`, or "Chapter 9 / Lesson 2".
   - **Chapter titles**: a file such as `Ch9 Shapes of Molecules & Intermolecular Forces.pdf` becomes a whole-chapter file, shown in every lesson of that chapter.
   - **Topic keywords** such as isotopes, VSEPR, hydrogen bonding. The file name counts more than the folder name.
4. Files that don't match are listed under **Files not linked to a lesson**, where you pick a lesson from the dropdown. Use **＋ Link file** or **×** on a lesson page to change links. Links you set by hand are kept when you click **Rescan**.
5. Each lesson page shows its files with **Open PDF** (opens in Google Drive) and **Preview** (built-in viewer). The Prepare page and today's class cards link to the same files.

**Lesson names from the chapter PDF.** When a PDF becomes a chapter's whole-chapter file, KBM downloads it from Drive and reads it in the browser with pdf.js (`pdf-sections.js`). This happens automatically after a scan, or when you choose "whole chapter" in a file's dropdown. KBM looks for that chapter's numbered sections, e.g. `9.1 …`, `9.2 …`:
- It reads the PDF's bookmarks first.
- Without bookmarks, it reads the page text and uses each section's largest heading, rather than its line on the contents page.

Those sections replace the chapter's lessons, so the number of lessons follows the book, and files are re-matched to the new names. Use **↻ Names from PDF** to read it again, **✎ Edit names** to set them by hand, and **Reset to defaults** to go back to the built-in names. Names you edit by hand are not overwritten by a rescan.

The file list, links and lesson names are saved in this browser only (`localStorage`). The Drive access token stays in memory, and nothing in Drive is changed.

**Google Cloud setup (once, for the OAuth client in `config.js` → `googleClientId`):**
- **Enable the Google Drive API:** APIs & Services → Library → **Google Drive API** → Enable.
- **Add the Drive scope:** OAuth consent screen → Data access → add `https://www.googleapis.com/auth/drive.readonly`.
- **Allow the site addresses:** the OAuth client's **Authorized JavaScript origins** must include `http://localhost:8080` and `https://gomappedai-rgb.github.io`.
- **Test users or verification:** `drive.readonly` is a restricted scope. While the app's publishing status is **Testing**, add each teacher's Google account under **Test users**. Opening the app to everyone requires Google's app verification.

## Scope

This is a front-end MVP. Lesson approval, draft edits, resource approvals and submission review are interactive prototype flows; they do not write to a school service. The demo dataset is initialized in the application script.
