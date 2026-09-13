# PhotoDays website SEO release

## Positioning and page map

The site is a photo diary and progress tracker for iPhone and iPad. Its three supporting pages explain distinct tasks:

| Route | Search task | Page proof |
| --- | --- | --- |
| `/` | Find PhotoDays / understand the app | Real photo sequence, app screens and demo |
| `/photo-diary/` | Keep a daily photo diary or journal | Dated albums, notes, Live Photos, flexible reminders |
| `/progress-photos/` | Track and compare progress photos | Framing guidance, two-date comparison, project examples |
| `/photo-progress-video/` | Make a progress video or photo time lapse | Album-to-video workflow, MP4/GIF distinctions |

The support, terms and privacy routes remain in the sitemap. Legacy `/ru/` pages redirect to English and remain `noindex`. The 404 page is also `noindex`.

## Keyword evidence

`keyword-map.csv` records decisions for all 202 queries in the English consolidated ASO archive, plus five explicit website/brand seeds. Source: `ProgressTracker`, branch `codex/aso-research-archive-v1`, `aso-research/final-positioning-v1/keyword_master_consolidated.csv`, research dated August 1, 2026.

The archive's App Store popularity and difficulty are not Google search volume or competition metrics and are intentionally not copied into website SEO scores. Google volume, positions, impressions and clicks have not been invented or filled with zeroes.

- `target`: relevant acquisition intent assigned to one page.
- `supporting`: useful phrasing or example within that page, not a reason for another landing page.
- `defer`: needs Google intent evidence before being a site target.
- `exclude`: rejected or competitor-only in the source research.
- `exclude_current_product`: expectations exceed the current verified product.

Visible copy uses natural phrases, without a meta-keywords tag, hidden keyword lists, repetition quotas or claims that every variant is an exact match. Supporting seeds are research candidates, not a promise of literal wording or ranking.

## Everank: zero-spend handoff

`everank-keywords.txt` contains 28 one-per-line seeds. `everank-keywords.csv` adds groups, target pages and locale. The CSV is a planning/export format; do not assume a particular Everank import schema. Use the text list with the app's supported paste/import control once its behavior has been checked.

Website: `https://photodays.app/`; country: United States; language: English. The future App Store listing is `https://apps.apple.com/app/id6811136068`, but it is not yet public. Keep website and App Store rankings separate.

Do not run refresh, research, scheduled checks or any DataForSEO request that might spend credits. Adding a keyword may itself trigger a check, so the delivered lists have not been auto-imported. Use only already available results until a spending budget is explicitly authorized. Do not enable outreach, email sending, data sharing or subscriptions as part of this release.

## Search Console

Use the existing Google account and URL-prefix property `https://photodays.app/`. Its owner-verification file is `public/googleacb1539d6b9becef.html`; keep it published after verification. This value was issued by Search Console for this property during the release work.

After deployment:

1. Confirm ownership using the HTML-file method.
2. Submit `https://photodays.app/sitemap.xml` in Sitemaps.
3. Inspect the homepage and all three topic pages. Run the live check and request indexing when available. Record Google's actual response; a successful submission is not proof of indexing.
4. Record the baseline in `launch-status.md`. For a new property, pending data is **unavailable**, not zero traffic.

## Compare after 28 days

This is a manual review checklist; no background automation or paid rank checks are enabled.

Use Search Console → Performance → Search results → Web. Compare the first 28 complete days after deployment with the preceding 28 days, if historical data exists. For a new property, keep the first window as baseline and compare against the next complete 28-day window.

Record clicks, impressions, CTR and average position by page and query. Segment US traffic and brand queries (`photodays` / `photo days`) from discovery queries. Search Console's average position is not a fixed rank and depends on the query and impression mix. Check index coverage, Google-selected canonicals and sitemap status before rewriting copy. Small samples do not support a confident ranking conclusion.

If Everank already has cached data, compare the same keyword, country, language and tracked destination. Leave missing positions as unavailable. Do not infer an improvement from a screenshot, Lighthouse score, successful crawl request or App Store popularity.

## App Store release switch

Current state: `appStoreUrl: null`. Before activation, open the official listing in the target storefront and confirm it is publicly available for download; an App Store Connect record or TestFlight build does not qualify.

Then set `appStoreUrl` in `src/config.ts` to `https://apps.apple.com/app/id6811136068`, run `npm test`, review the release FAQ and buttons, and publish. The shared CTA, FAQ availability answer and SoftwareApplication install URL follow this configuration. Confirm launch features and pricing separately; do not advertise iCloud until the release build has passed its sync checks.

## Verification and rollback

Run `npm test`. It builds static HTML and checks route metadata, canonical URLs, sitemap, broken internal links/fragments, indexability, release CTAs, JSON-LD, the verification file, and the approved media's dimensions/checksums. GitHub Actions runs the same validation before deploying `main`.

Pre-redesign production commit: `b4e3e000409a97e7a228afe2720bc2aff439eba9`.

To roll back, create a revert of the redesign release commit on `main` and run the normal validation/deployment process. Preserve the Search Console verification file when reverting website content, so ownership remains valid. Do not reset or force-push `main`.

References: [Google SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide), [Google URL Inspection](https://support.google.com/webmasters/answer/9012289), [Everank](https://everank.com/).
