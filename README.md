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
