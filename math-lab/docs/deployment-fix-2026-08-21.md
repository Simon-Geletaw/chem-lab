# Deployment Fix — Route-Prefixed Lab Assets

**Date:** 2026-08-21  
**Scope:** Deployment packaging and routing only. No Three.js scene or lighting code was changed.  
**Planned commit:** `fix(deploy): package lab assets under route prefixes`

## Failure

The deployed site at `https://aitsimulation.vercel.app/` showed the Chemistry Lab loader permanently at `0%`. The deployed HTML pages loaded, but their JavaScript bundles returned 404 responses:

| Request | Response |
|---|---|
| `/c/assets/index-e29HCd9H.js` | `404 — not found` |
| `/m/assets/index-C2OUiVGT.js` | `404 — not found` |

The same failure affected the other lab prefixes. Because the application bundle never executed, the loader could not advance. The local Vite builds succeeded, and the complete Math Lab dist output was only about 1.83 MB, so the failure was not caused by Three.js code or artifact size.

## Root cause

Each lab is an independent Vite application whose HTML is built with a route base: Chemistry uses `/c/`, Biology `/b/`, Math `/m/`, and Physics `/p/`. The custom local `server.mjs` maps those prefixes to each lab’s `dist` directory. The generic Vercel deployment did not reproduce that directory layout or custom Node routing. It served the HTML entry pages but did not expose the expected `/<lab>/assets/`, `/<lab>/Models/`, and `/<lab>/Logo/` files.

## Fix

The root build now performs three operations:

1. `node dev.mjs --build` builds every lab.
2. `node scripts/prepare-vercel.mjs` copies each lab’s `dist` folder into `public/c/`, `public/b/`, `public/m/`, and `public/p/`, then copies the Chemistry entry page to `public/index.html` for the root hub route.
3. `vercel.json` tells Vercel to run `npm run build` and serve `public` as the output directory.

The root build runner was also corrected to wait for all child lab builds to close successfully before packaging. This prevents Vercel packaging from racing ahead of a still-running child build, especially on Windows.

The deterministic `scripts/verify-vercel-output.mjs` check confirms that all four route entry pages exist and that every route-prefixed asset referenced by their HTML exists in the generated output.

## Files changed

| File | Purpose |
|---|---|
| `vercel.json` | Sets the root build command and `public` output directory. |
| `package.json` | Adds the Vercel packaging step to the root build. |
| `dev.mjs` | Waits for all lab builds and handles Windows process launching reliably. |
| `scripts/prepare-vercel.mjs` | Produces the route-prefixed `public/` deployment tree. |
| `scripts/verify-vercel-output.mjs` | Validates entry pages and referenced assets. |
| `.gitignore` | Keeps generated `public/` output out of Git. |
| `math-lab/docs/deployment-fix-2026-08-21.md` | Records diagnosis, implementation, validation, and redeployment instructions. |

## Local validation

The following commands pass:

```text
npm run build
node scripts/verify-vercel-output.mjs
git diff --check
```

The verifier reports:

```text
verified /c/ (4 route-prefixed assets)
verified /b/ (4 route-prefixed assets)
verified /m/ (4 route-prefixed assets)
verified /p/ (4 route-prefixed assets)
vercel output verification passed
```

The generated `public/` directory is intentionally not committed. Vercel creates it during the deployment build from the committed source and scripts.

## How to redeploy on Vercel

From the repository root, run:

```text
npm install
npm run build
node scripts/verify-vercel-output.mjs
```

Then push the committed changes to the branch connected to the Vercel project, or run the Vercel deployment command from the repository root. In Vercel Project Settings, use these values if dashboard overrides are present:

| Setting | Value |
|---|---|
| Root Directory | Repository root, not `math-lab` |
| Framework Preset | Other, or the configuration from `vercel.json` |
| Build Command | `npm run build` |
| Output Directory | `public` |
| Install Command | `npm install` |

Do not set the Vercel Root Directory to `math-lab` for this combined deployment; doing so would omit the other lab outputs and bypass the root packaging script.

After deployment, verify these URLs and ensure they return JavaScript or static assets rather than 404 responses:

```text
https://<deployment-domain>/
https://<deployment-domain>/c/
https://<deployment-domain>/b/
https://<deployment-domain>/m/
https://<deployment-domain>/p/
```

A successful deployment should load the Chemistry Lab at `/`, and the Math Lab bundle should be reachable under `/m/assets/`. If the Vercel project is configured as a single Math Lab-only project instead of a combined lab deployment, use `math-lab` as the Root Directory and deploy only its `dist` output; do not use the combined-root configuration for that separate project.

## Rollback

Revert the deployment commit. The existing local `server.mjs` workflow and the previously committed lighting fix remain independent of this deployment packaging change.
