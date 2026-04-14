# TR Studio Portfolio

Static portfolio + browser admin for GitHub Pages, with a serverless GitHub write proxy.

## What changed

- `index.html` now renders published data from `content.json` only.
- `admin.html` treats `localStorage` as draft storage only.
- Shared schema logic lives in `shared/content-utils.js`.
- Multi-file upload now targets the GitHub-backed upload API instead of storing base64 media in the browser.
- `content.json` is the canonical published source of truth.
- A real default logo now exists at `assets/uploads/brand/default-logo.svg`.

## File layout

- `index.html`: public portfolio page
- `admin.html`: draft editor + publish UI
- `content.json`: canonical published content
- `shared/content-utils.js`: shared schema, validation, and helpers
- `scripts/site.js`: public page logic
- `scripts/admin.js`: admin editor logic
- `api/upload-media.js`: media upload endpoint
- `api/save-content.js`: publish `content.json`
- `api/content-state.js`: fetch published `content.json` metadata
- `api/github-client.js`: GitHub API wrapper

## Environment

Create environment variables using `.env.example`.

- `GITHUB_TOKEN`: GitHub token with repo write access
- `GITHUB_OWNER`: repository owner
- `GITHUB_REPO`: repository name
- `GITHUB_BRANCH`: branch used for Pages content
- `ADMIN_SECRET`: shared secret required by the admin UI for upload/publish
- `PUBLIC_BASE_PATH`: public site base path for returned asset URLs

## Deploying the serverless proxy

GitHub Pages cannot run serverless functions. The intended split is:

- public portfolio hosted on GitHub Pages
- `api/*` deployed on a serverless platform such as Vercel

If the API is deployed on another domain, set the API base in `admin.html`:

```html
<meta name="tr-api-base" content="https://your-proxy.example.com">
```

or provide `window.TR_ADMIN_CONFIG = { apiBase: "https://your-proxy.example.com" }` before loading `scripts/admin.js`.

## Admin workflow

1. Open `admin.html`.
2. Enter the shared `ADMIN_SECRET`.
3. Edit text locally. Draft state is kept in `localStorage`.
4. Upload logo, hero media, credential images, or reel media through the GitHub proxy.
5. Click `Publish to GitHub` to write `content.json`.

## Notes

- Uploaded files are written under `assets/uploads/...`.
- Reel multi-file upload creates one reel item per uploaded file.
- Video poster generation is not automated in this version. Videos default their thumbnail to the uploaded source path until changed.
- The repo-relative `storedPath` is what gets saved into `content.json`.

## Checks

Run:

```bash
npm run check
```
