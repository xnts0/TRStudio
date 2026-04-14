# TR Studio Portfolio

Static portfolio and admin UI hosted on GitHub Pages, with GitHub Actions used for publishing `content.json`.

## Architecture

- `index.html` reads published content from `content.json`
- `admin.html` edits local draft content in the browser
- publishing triggers a GitHub Actions `workflow_dispatch`
- the workflow writes `content.json` back to `main`
- media files are hosted in the repository under `assets/uploads/...`

There is no separate backend in this version.

## Files

- `index.html`: public portfolio page
- `admin.html`: GitHub Pages admin UI
- `content.json`: canonical published content
- `shared/content-utils.js`: schema, validation, helpers
- `scripts/site.js`: public page logic
- `scripts/admin.js`: admin logic
- `.github/workflows/publish-content.yml`: GitHub Actions publisher
- `.github/workflows/static.yml`: GitHub Pages deployment
- `.github/workflows/validate-content.yml`: content validation

## GitHub-only publish flow

1. Open `admin.html` on GitHub Pages.
2. Enter a GitHub token with permission to trigger Actions workflows.
3. Edit the draft locally.
4. For media:
   - upload files to the repo manually using Git or the GitHub web UI
   - keep them under `assets/uploads/...`
   - use repo-relative paths in the admin
5. Click `Publish to GitHub`.
6. The workflow commits `content.json` to `main`.
7. GitHub Pages redeploys automatically.

## Token requirements

The admin UI triggers `workflow_dispatch` from the browser, so the user must provide a token interactively.

Recommended scopes:

- classic PAT: `repo`, `workflow`
- fine-grained PAT:
  - repository access to this repo
  - Actions: read/write
  - Contents: read

Do not hardcode this token in the repo or page source.

## Media handling

GitHub Pages cannot securely upload media files back into the repository from a static page without exposing a write credential.

So in this GitHub-only version:

- local file selection in the admin is used only to generate suggested repo paths
- the actual files must be uploaded to the repository separately
- the generated paths should match the files you add under `assets/uploads/...`

Example:

- local file: `hero-shot.mp4`
- suggested path: `assets/uploads/hero/hero-shot.mp4`

## Workflow input size

The publish workflow receives base64-encoded `content.json` through `workflow_dispatch`.

That works well for normal portfolio metadata, but it is not a good fit for embedding large binary assets in the payload. Media stays in the repo as files for that reason.

## Optional overrides

The admin tries to infer `owner/repo/branch` from the GitHub Pages URL.

If you need overrides, set them before loading `scripts/admin.js`:

```html
<script>
  window.TR_ADMIN_CONFIG = {
    repoOwner: "xnts0",
    repoName: "TRStudio",
    repoBranch: "main",
    workflowId: "publish-content.yml"
  };
</script>
```

## Checks

Run:

```bash
npm run check
```
