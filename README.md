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

**Lesson names from the PDFs: ⟳ Scan PDFs.** The **⟳ Scan PDFs** button at the top of Lessons lists the folder again (choosing one first if none is linked), then reads every PDF in it in the browser with pdf.js (`pdf-sections.js`). For each PDF, KBM looks for:
- **Numbered headings** such as `6.1 …` or `9.2 …`, from the bookmarks or the page text. The headings in the PDF's largest font are its own titles; smaller numbered lines (contents entries, mentions in the text) are ignored.
- **The first page's title**: the largest line on page 1, e.g. `The Bohr Model` or `Lesson 2: The Bohr Model`. It's used when the PDF has no numbered heading. Book/chapter banners such as "Cracking Chemistry" or "Chapter 6" are skipped.

Then (`lessons.js` → `classifyHeadings`, `planFromPdfs`):
- **A PDF with one numbered title**, e.g. `6.2 The Bohr Model`, names lesson 6.2 and is linked to it, whatever the file is called.
- **A PDF whose title has no number** names the lesson it is linked to by its file name (e.g. `Lesson 6.2.pdf`, `Atomic theory lesson 2.pdf`) or by hand. A number in the file name that the plan doesn't have yet (e.g. `Lesson 9.5.pdf`) adds that lesson.
- **A whole-chapter PDF** has several numbered titles of one chapter. Its sections become that chapter's lessons, so the number of lessons follows the book; lesson PDFs then rename their own sections.
- **Lessons no PDF names** keep their current name (default, hand-edited, or from an earlier scan).

After a scan, a **Scan results** table lists each PDF, the title found and how it was found, and the lesson it is linked to, so wrong titles or links are easy to spot and fix. Titles are cached per file: choosing a folder only reads new or changed PDFs, while **⟳ Scan PDFs** re-reads them all and its titles replace names you edited by hand. Use **✎ Edit names** to set names yourself and **Reset to defaults** to go back to the built-in names. Scanned PDFs without a text layer have no readable titles; those files are matched by name.

The file list, links and lesson names are saved in this browser only (`localStorage`). The Drive access token stays in memory, and nothing in Drive is changed.

**Google Cloud setup (once, for the OAuth client in `config.js` → `googleClientId`):**
- **Enable the Google Drive API:** APIs & Services → Library → **Google Drive API** → Enable.
- **Add the Drive scope:** OAuth consent screen → Data access → add `https://www.googleapis.com/auth/drive.readonly`.
- **Allow the site addresses:** the OAuth client's **Authorized JavaScript origins** must include `http://localhost:8080` and `https://gomappedai-rgb.github.io`.
- **Test users or verification:** `drive.readonly` is a restricted scope. While the app's publishing status is **Testing**, add each teacher's Google account under **Test users**. Opening the app to everyone requires Google's app verification.

## Scope

This is a front-end MVP. Lesson approval, draft edits, resource approvals and submission review are interactive prototype flows; they do not write to a school service. The demo dataset is initialized in the application script.
