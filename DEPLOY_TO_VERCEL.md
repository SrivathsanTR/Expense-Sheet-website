# Fix the Vercel deployment

The screenshot shows Vercel trying to execute `/var/task/server.mjs` and rejecting its exports. Together is a browser app; its original server is only for running locally. Deploy its HTML, CSS, and JavaScript as static files instead.

## Deploy this corrected project

1. Extract this ZIP. Use the contents of `together-expenses-vercel` as your deployment source. It includes the original app and new `vercel.json`, `build.js`, and `.vercelignore` files.
2. If deploying from GitHub, replace the old project's files with this corrected project and commit/push the change. Remove any old `server.mjs`, `api/` server wrapper, or old Vercel configuration created for the previous deployment. Do not delete unrelated files from a larger repository.
3. In Vercel project settings, choose the root directory containing this project's `package.json` AND `vercel.json`.
4. Framework Preset: **Other**. Build Command: **node build.js**. Output Directory: **dist**. No install command is needed because the project has no dependencies. The included `vercel.json` sets these values.
5. Deploy the new source commit. Redeploying the old commit alone will not apply the fix. If offered, disable the existing build cache for this first corrected deployment.

Do not set the hosted start command to `npm start` or `node server.js`. Do not rewrite all requests to a server function. The new build produces only `index.html` and the three files in `src/` inside `dist/`.

## Run locally

The original `server.js` remains available locally. Run `node server.js` from this folder, or use the verified absolute Node executable path described in the chat if Node is not on your PATH. See README.md for full instructions.

## Data and verification limits

Publishing makes the website reachable online, but each browser still has its own localStorage dataset. It does not add shared accounts or multi-device synchronization. Export your localhost data as JSON, then restore it on the hosted address to move it. Preview deployment URLs and your production domain each have separate browser storage.

The static build and assets were checked locally. The live Vercel deployment has not been changed or verified from this chat.

Official configuration reference: https://vercel.com/docs/project-configuration/vercel-json
