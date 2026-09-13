# Release status

## Prepared and verified

- Static Astro production build: seven canonical routes, four legacy English redirects and a noindex 404.
- `npm test`: passed. Metadata, links, sitemap, app availability gating, JSON-LD, media provenance and Google verification-file checks are included.
- Lighthouse: see `lighthouse-summary.json` for timestamps and individual results. Tests used the local production output, not the development server. These are lab quality scores, not evidence of Google rankings.
- Browser QA: desktop 1280px and mobile 390px layouts; comparison keyboard Home/End/ArrowRight produced 0/100/2; mobile menu navigation and expandable FAQ worked; demo play/pause verified.
- Text enlargement: 200% root font size in a temporary local HTML fixture at desktop and 390px; no horizontal document overflow.
- Reduced-motion behavior: temporary local fixture returning the reduced-motion preference to the existing media scripts; autoplay stayed paused, manual playback worked. System settings were not changed. QA fixtures were removed and cannot be published by validation.
- Support page visually checked after the shared stylesheet redesign.
- App Store listing returned HTTP 404 during this release. Download URL remains null and the site says Coming soon.

## Network findings

Public Google DNS returned the four standard GitHub Pages IPv4 addresses: 185.199.108.153, 185.199.109.153, 185.199.110.153 and 185.199.111.153. No AAAA answer was returned. Authoritative nameservers are ns1.reg.ru and ns2.reg.ru; www points to mikhailkostylev.github.io.

A request to the domain against its returned GitHub Pages address passed normal TLS certificate validation and returned HTTPS 200. HTTP redirected to HTTPS with 301. The local resolver intermittently timed out while public DNS worked. This supports a resolver/routing investigation if the symptom returns; it does not establish a VPN or geographical blocking cause. The owner reported that VPN access was working again. No domain, DNS, VPN or hosting settings were changed.

## Search Console baseline

The signed-in owner account could access Search Console, but the URL-prefix property `https://photodays.app/` was unverified. Google issued the HTML verification file included in this release.

Verification, sitemap submission and URL Inspection results will be recorded after the deployment is live. Clicks, impressions, CTR, average position and index coverage are unavailable at this pre-verification point, not zero.

## Everank

28 grouped seeds are prepared. No paid DataForSEO requests, refreshes, background checks or outreach were enabled. Google volume and ranking estimates remain unavailable.
