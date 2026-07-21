import type { APIRoute } from 'astro';
import { siteConfig } from '../config';

const routes = [
	['/', '/ru/'],
	['/privacy/', '/ru/privacy/'],
	['/terms/', '/ru/terms/'],
	['/support/', '/ru/support/'],
] as const;

export const GET: APIRoute = () => {
	const urls = routes.flatMap(([enPath, ruPath]) => [
		{ loc: enPath, enPath, ruPath },
		{ loc: ruPath, enPath, ruPath },
	]);
	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map(({ loc, enPath, ruPath }) => `  <url>
    <loc>${new URL(loc, siteConfig.siteUrl)}</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${new URL(enPath, siteConfig.siteUrl)}" />
    <xhtml:link rel="alternate" hreflang="ru" href="${new URL(ruPath, siteConfig.siteUrl)}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${new URL(enPath, siteConfig.siteUrl)}" />
  </url>`).join('\n')}
</urlset>`;

	return new Response(body, {
		headers: { 'Content-Type': 'application/xml; charset=utf-8' },
	});
};
