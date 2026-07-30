import type { APIRoute } from 'astro';
import { siteConfig } from '../config';

const routes = ['/', '/privacy/', '/terms/', '/support/'] as const;

export const GET: APIRoute = () => {
	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map((path) => `  <url><loc>${new URL(path, siteConfig.siteUrl)}</loc></url>`).join('\n')}
</urlset>`;

	return new Response(body, {
		headers: { 'Content-Type': 'application/xml; charset=utf-8' },
	});
};
