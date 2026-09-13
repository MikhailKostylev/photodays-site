# Release status

## Published and verified

- Release commit: `e901f9731d0b6d0403c60a7dfa07d94ba7e91d33`, deployed to `main` on September 13, 2026 at 20:54 UTC. [GitHub Pages build and deployment](https://github.com/MikhailKostylev/photodays-site/actions/runs/34782167773) succeeded.
- Rollback branch: `codex/photodays-before-seo-20260913`, preserving production commit `b4e3e000409a97e7a228afe2720bc2aff439eba9`.
- Post-deploy HTTPS checks passed for all seven canonical pages, sitemap, robots, the verification file and `/ru/`, with normal DNS resolution and valid TLS. See `public-smoke.json`.
- Static Astro production build: seven canonical routes, four legacy English redirects and a noindex 404.
- `npm test`: passed. Metadata, links, sitemap, app availability gating, JSON-LD, media provenance and Google verification-file checks are included.
- Lighthouse: see `lighthouse-summary.json` for timestamps and individual results. Tests used the local production output, not the development server. These are lab quality scores, not evidence of Google rankings.
- Public demo playback loaded successfully with no media error; play/pause worked after deployment.
- Browser QA: desktop 1280px and mobile 390px layouts; comparison keyboard Home/End/ArrowRight produced 0/100/2; mobile menu navigation and expandable FAQ worked; demo play/pause verified.
- Text enlargement: 200% root font size in a temporary local HTML fixture at desktop and 390px; no horizontal document overflow.
- Reduced-motion behavior: temporary local fixture returning the reduced-motion preference to the existing media scripts; autoplay stayed paused, manual playback worked. System settings were not changed. QA fixtures were removed and cannot be published by validation.
- Support page visually checked after the shared stylesheet redesign.
- App Store listing returned HTTP 404 during this release. Download URL remains null and the site says Coming soon.

## Network findings

Public Google DNS returned the four standard GitHub Pages IPv4 addresses: 185.199.108.153, 185.199.109.153, 185.199.110.153 and 185.199.111.153. No AAAA answer was returned. Authoritative nameservers are ns1.reg.ru and ns2.reg.ru; www points to mikhailkostylev.github.io.

A request to the domain against its returned GitHub Pages address passed normal TLS certificate validation and returned HTTPS 200. HTTP redirected to HTTPS with 301; `https://www.photodays.app/` also redirected to the canonical HTTPS domain with 301 and a valid certificate. The local resolver intermittently timed out while public DNS worked. This supports a resolver/routing investigation if the symptom returns; it does not establish a VPN or geographical blocking cause. The owner reported that VPN access was working again. No domain, DNS, VPN or hosting settings were changed.

## Search Console baseline

Ownership of the URL-prefix property `https://photodays.app/` was confirmed using the Google-issued HTML file on September 13, 2026 (UTC). Keep `public/googleacb1539d6b9becef.html` published.

Google accepted `https://photodays.app/sitemap.xml` with status **Success**, identifying **7 pages**. The property overview says performance, index coverage and other reports are processing and to check again in approximately a day. Clicks, impressions, CTR and average position are **unavailable**, not zero.

URL Inspection observations from September 13, 2026, 21:00–21:08 UTC (September 14 in the owner’s Moscow timezone) are recorded below. A live test or accepted crawl request is not a guarantee that a page or its latest version is indexed.

| URL | Index baseline | Live test | Indexing request |
| --- | --- | --- | --- |
| `/` | Already indexed; previous crawl August 23, 2026 at 06:24:54 as displayed by Search Console; Google-selected canonical matches the inspected URL | URL available to Google; can be indexed | Accepted, priority crawl queue |
| `/photo-diary/` | Discovered, currently not indexed; sitemap source; no prior crawl | Available to Google; can be indexed; one valid breadcrumb item | Accepted, priority crawl queue |
| `/progress-photos/` | Discovered, currently not indexed; sitemap source; no prior crawl | Available to Google; can be indexed; one valid breadcrumb item | Accepted, priority crawl queue |
| `/photo-progress-video/` | Crawled, currently not indexed; last crawl September 14, 2026 at 00:05:26 as displayed; desktop Googlebot; successful fetch | Available to Google; can be indexed; one valid breadcrumb item | Accepted, priority crawl queue |

All four live tests passed. All four indexing requests were accepted. The three topic pages were not indexed at the time of their index-baseline inspections; no immediate ranking or indexing result is claimed.

The first full 28-day reporting window is September 14–October 11, 2026. Review from October 12 after processing; see `README.md` for the exact comparison and segmentation checklist.

## Everank

28 grouped seeds are prepared. No paid DataForSEO requests, refreshes, background checks or outreach were enabled. Google volume and ranking estimates remain unavailable.
