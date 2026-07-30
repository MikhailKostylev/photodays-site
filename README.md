# PhotoDays website

The English marketing, support and legal website for PhotoDays.

## Public routes

- `/` — benefit-led product landing page
- `/privacy/`
- `/terms/`
- `/support/`

Legacy `/ru/` routes are English `noindex` redirects to their canonical English pages. They remain only so old links do not break and are not included in the sitemap.

## Local development

```sh
npm install
npm run dev
```

Run `npm test` before publishing. The site is generated as static HTML and deployed to GitHub Pages by `.github/workflows/deploy.yml`.

The App Store URL is intentionally `null` in `src/config.ts`. Add the released app URL there to activate every download button.

## Marketing media

The landing page uses approved real PhotoDays photography and product recordings:

- 35 aligned source portraits produce the Day 1 / Day 365 comparison and 4.4-second progress film.
- The 25.1-second July 29 product recording produces the main demo and saved-video/share proof.
- Deterministic `ProgressTrackerMarketingDemo` captures provide the Home, timeline, camera, comparison, progress, video, reminder and privacy states used beside the site copy.
- The original first 0.3 seconds of the product recording are replaced with its clean Home frame.
- The recap, master recording, M4V files and original 35 PNG files are never copied into `public` or `dist`.

Public provenance, transformation details and checksums are recorded in `public/media/provenance.json` without personal filesystem paths.

Developer-only media commands:

```sh
npm run media:photos -- /path/to/sequence /path/to/image-output /path/to/progress-film.mp4 /path/to/progress-poster.png
npm run media:video -- /path/to/product-source.mp4 /path/to/product-demo.mp4 /path/to/product-poster.png /path/to/screens
npm run media:build -- --progress-poster /path/to/progress-poster.png --product-poster /path/to/product-poster.png --sequence-root /path/to/sequence --product-source /path/to/product-source.mp4
```

Do not commit source recordings or the source photo collection to this public repository.
