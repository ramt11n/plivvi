# Host the workshop without renting a server

Pocket builds to ordinary static files in `dist`. PDF work runs in the visitor’s browser. You do not need a rented VM, a continuously running Node server, or an Apple developer membership.

## Current public links

The [interactive workshop](https://pocket-pdf-ramtin.pages.dev) is published on Cloudflare Pages in the owner’s account. The [GitHub project page](https://ramt11n.github.io/pocket-pdf/) is a shorter launch and contribution link. GitHub Actions tests the app and publishes the project page. The app is deployed through Cloudflare’s Direct Upload interface. Automatic app deployment remains unconfigured; the included Actions workflow needs a scoped Cloudflare token and account variables before it can be enabled.

## Alternative public host: Cloudflare Pages

Cloudflare Pages provides a free `project-name.pages.dev` address, HTTPS, and static hosting. The free plan currently allows 500 builds/month, 20,000 files, and individual assets up to 25 MiB. Pocket’s largest bundled engine fits under that per-file limit. Account and service terms still apply; no third-party service promises a permanent domain forever. See [Pages limits](https://developers.cloudflare.com/pages/platform/limits/) and [custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/).

1. Create a Pages project in your own Cloudflare account. Choose a short available name, such as `pocket-pdf-ramtin`; the actual URL is assigned by Cloudflare.
2. Use direct-upload deployment if you want the included GitHub Actions workflow to publish it. Alternatively, connect the GitHub repository in Cloudflare and use `npm run build` with output directory `dist` and Node 24.
3. For Actions, create an account-scoped API token limited to editing Cloudflare Pages for the relevant account. Store it as the repository secret `CLOUDFLARE_API_TOKEN`, and the account ID as `CLOUDFLARE_ACCOUNT_ID`.
4. Add repository variables `CLOUDFLARE_PROJECT_NAME` and `SITE_URL` (the actual HTTPS website origin). The deployment workflow is intentionally skipped until the project name is set.
5. Push to `main` or run **Deploy to Cloudflare Pages** manually. The workflow tests, builds, verifies SEO output, and deploys the resulting static files.

Public browser integration values can be repository variables: `FIREBASE_CONFIG`, `GOOGLE_CLIENT_ID`, `GOOGLE_API_KEY`, `GOOGLE_APP_ID`, `MICROSOFT_CLIENT_ID`, and `MICROSOFT_TENANT`. Restrict browser API keys and register each exact production origin. Never put admin/service-account secrets or Cloudflare tokens in `VITE_*` values.

## Why not use GitHub Actions as the server?

Actions is a build/deployment runner, not a permanent public web server. GitHub is the source and contribution home; a static host serves the compiled files.

GitHub Pages offers `username.github.io/repository` URLs, but its [usage limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) say it is not intended for running an online business, ecommerce site, or commercial SaaS. A commercial/ad-supported production plan is better placed on a suitable static host. Do not assume a policy prohibition on every donation link; evaluate the actual site’s primary purpose and current terms.

Netlify’s Free plan explicitly permits commercial projects but has usage credits and can pause sites at the plan limit. Vercel Hobby is for personal/noncommercial use. Check provider terms and quotas before changing hosts. [Netlify](https://www.netlify.com/pricing/), [Vercel terms](https://vercel.com/legal/terms).

## Local production check

```sh
npm ci
npm test
node scripts/prepare-source.mjs
npm run build
node scripts/verify-build.mjs
npm run preview
```

Serve over HTTPS in production. Keep `redirect.html` as a separate MSAL bridge page; it must not be replaced by the SPA shell or served with `Cross-Origin-Opener-Policy`. The service worker excludes this callback, its host-normalized `/redirect` and `/redirect/` aliases, and runtime integration configuration from caching.

## Moving domains

Set `VITE_SITE_URL`/`SITE_URL` to the actual new origin before building. Update Firebase authorized domains, Google authorized JavaScript origins, and the exact Microsoft SPA redirect URL. Browser workspaces and drafts belong to an origin and do not migrate automatically: export important outputs before moving. Short links can redirect to the canonical production address, but they do not establish domain ownership or improve SEO by themselves.

## Stable GitHub project link

The included `project-site` is a separate, small open-source documentation/launch page for GitHub Pages. It contains no document processing, accounts, paid transactions, or advertising. The interactive workshop remains on its separate production host. With Pages enabled and `ENABLE_PROJECT_PAGE=true`, the `project-page.yml` workflow publishes this project page at the repository's assigned `github.io` URL. This is a project-home/launch link, not a claim that the monetized PWA itself runs on GitHub Pages.
