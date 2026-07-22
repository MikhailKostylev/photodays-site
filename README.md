# PhotoDays website

The bilingual marketing, support and legal website for PhotoDays.

## Routes

- `/` and `/ru/` — product landing pages
- `/privacy/` and `/ru/privacy/`
- `/terms/` and `/ru/terms/`
- `/support/` and `/ru/support/`

## Local development

```sh
npm install
npm run dev
```

Run `npm test` before publishing. The site is built as static HTML and deployed to GitHub Pages by the workflow in `.github/workflows/deploy.yml`.

The App Store URL is intentionally `null` in `src/config.ts`. Add the released app URL there to activate every download button.

## Marketing media

The product screenshots, aligned comparison pair, video poster and Open Graph card are derived from the real `codex/mock-data-for-marketing` demo at commit `11e8c249`. Public provenance and checksums are recorded in `public/media/provenance.json`.

To rebuild the image derivatives after replacing the approved source captures:

```sh
npm run media:build
```

The short web video is exported by `scripts/transcode-product-video.swift`. Do not commit the 41-second production master or the original 53 demo photographs to this public repository.
