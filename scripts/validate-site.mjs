import { access, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = new URL('../dist/', import.meta.url);
const distPath = fileURLToPath(dist);
const requiredFiles = [
	'index.html',
	'ru/index.html',
	'privacy/index.html',
	'ru/privacy/index.html',
	'terms/index.html',
	'ru/terms/index.html',
	'support/index.html',
	'ru/support/index.html',
	'404.html',
	'sitemap.xml',
	'robots.txt',
	'CNAME',
	'og.png',
];

for (const file of requiredFiles) {
	await access(new URL(file, dist));
}

const htmlFiles = [];
async function collectHtml(directory, relative = '') {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const nextRelative = join(relative, entry.name);
		if (entry.isDirectory()) await collectHtml(join(directory, entry.name), nextRelative);
		if (entry.isFile() && entry.name.endsWith('.html')) htmlFiles.push(nextRelative);
	}
}

await collectHtml(distPath);

const errors = [];
for (const file of htmlFiles) {
	const html = await readFile(new URL(file, dist), 'utf8');
	if (html.includes('href="#"')) errors.push(`${file}: placeholder link found`);
	if (!html.includes('rel="canonical"')) errors.push(`${file}: canonical URL missing`);
	if (!html.includes('hreflang="en"') || !html.includes('hreflang="ru"')) {
		errors.push(`${file}: language alternates missing`);
	}
	if (!html.includes('name="viewport"')) errors.push(`${file}: viewport metadata missing`);
	for (const image of html.matchAll(/<img[^>]*>/gi)) {
		if (!/\balt(?:=|\s|>)/i.test(image[0])) errors.push(`${file}: image without alt text`);
	}
}

const support = await readFile(new URL('support/index.html', dist), 'utf8');
const supportRu = await readFile(new URL('ru/support/index.html', dist), 'utf8');
for (const [file, html] of [['support/index.html', support], ['ru/support/index.html', supportRu]]) {
	if (!html.includes('mailto:support@photodays.app')) errors.push(`${file}: support email missing`);
	if (!html.includes('PhotoDays%20Support%20Request')) errors.push(`${file}: support subject missing`);
	if (!html.includes('PhotoDays%20Bug%20Report')) errors.push(`${file}: bug-report subject missing`);
}

const home = await readFile(new URL('index.html', dist), 'utf8');
if (!home.includes('application/ld+json')) errors.push('index.html: SoftwareApplication data missing');
if (!home.includes('Coming soon on the App Store')) errors.push('index.html: pre-release CTA missing');
if (home.includes('href="#"')) errors.push('index.html: fake CTA link found');

if (errors.length) {
	throw new Error(`Site validation failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
}

console.log(`Validated ${htmlFiles.length} HTML pages and ${requiredFiles.length} required assets.`);
