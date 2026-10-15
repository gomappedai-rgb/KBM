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

Without a client ID, the Connect account actions explain the setup requirement. The remaining Google Classroom connection is a placeholder. Data shown in the teacher workspace is illustrative, not connected to a school's records.

## Scope

This is a front-end MVP. Lesson approval, draft edits, resource approvals and submission review are interactive prototype flows; they do not write to a school service. The demo dataset is initialized in the application script.
