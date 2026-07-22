import { access, readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

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
	'media/photodays-product-demo.mp4',
	'media/provenance.json',
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

	for (const match of html.matchAll(/href="([^"]+)"/gi)) {
		const href = match[1];
		if (!href.startsWith('/') || href.startsWith('//')) continue;
		const pathname = href.split(/[?#]/, 1)[0];
		if (pathname === '/') continue;
		const target = pathname.endsWith('/')
			? `${pathname.slice(1)}index.html`
			: pathname.slice(1);
		try {
			await access(new URL(target, dist));
		} catch {
			errors.push(`${file}: broken internal link ${href}`);
		}
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
if (!home.includes('First photo') || !home.includes('Latest photo')) {
	errors.push('index.html: localized before/after labels missing');
}
for (const requiredVideoMarkup of [
	'<video',
	'preload="none"',
	'muted',
	'playsinline',
	'loop',
	'data-src="/media/photodays-product-demo.mp4"',
	'data-product-video-toggle',
]) {
	if (!home.includes(requiredVideoMarkup)) {
		errors.push(`index.html: missing product-video markup ${requiredVideoMarkup}`);
	}
}

const homeRu = await readFile(new URL('ru/index.html', dist), 'utf8');
if (!homeRu.includes('Первый снимок') || !homeRu.includes('Последний снимок')) {
	errors.push('ru/index.html: localized before/after labels missing');
}

const screenNames = ['home', 'progress', 'camera', 'compare', 'video', 'reminder', 'settings'];
for (const name of screenNames) {
	const metadata = await sharp(
		fileURLToPath(new URL(`../src/assets/screens/${name}.png`, import.meta.url)),
	).metadata();
	if (metadata.width !== 1206 || metadata.height !== 2622) {
		errors.push(`${name}.png: expected 1206x2622, received ${metadata.width}x${metadata.height}`);
	}
}

for (const name of ['first', 'latest']) {
	const metadata = await sharp(
		fileURLToPath(new URL(`../src/assets/demo/${name}.jpg`, import.meta.url)),
	).metadata();
	if (metadata.width !== 1280 || metadata.height !== 800) {
		errors.push(`${name}.jpg: expected 1280x800, received ${metadata.width}x${metadata.height}`);
	}
}

const posterUrl = new URL('../src/assets/video/product-demo-poster.webp', import.meta.url);
const posterMetadata = await sharp(fileURLToPath(posterUrl)).metadata();
const posterStats = await stat(posterUrl);
if (posterMetadata.width !== 540 || posterMetadata.height !== 1174) {
	errors.push(`product video poster: expected 540x1174, received ${posterMetadata.width}x${posterMetadata.height}`);
}
if (posterStats.size > 100_000) {
	errors.push(`product video poster exceeds 100 KB (${posterStats.size} bytes)`);
}

const videoStats = await stat(new URL('media/photodays-product-demo.mp4', dist));
if (videoStats.size > 3_500_000) {
	errors.push(`product video exceeds 3.5 MB (${videoStats.size} bytes)`);
}

const ogMetadata = await sharp(fileURLToPath(new URL('og.png', dist))).metadata();
if (ogMetadata.width !== 1200 || ogMetadata.height !== 630) {
	errors.push(`og.png: expected 1200x630, received ${ogMetadata.width}x${ogMetadata.height}`);
}

const provenance = JSON.parse(await readFile(new URL('media/provenance.json', dist), 'utf8'));
if (provenance.source?.commit !== '11e8c2490dc910c845f92facbec26fc15abff0b4') {
	errors.push('media/provenance.json: source commit missing or incorrect');
}

const distFiles = [];
async function collectFiles(directory, relative = '') {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const nextRelative = join(relative, entry.name);
		if (entry.isDirectory()) await collectFiles(join(directory, entry.name), nextRelative);
		if (entry.isFile()) distFiles.push(nextRelative);
	}
}
await collectFiles(distPath);
for (const file of distFiles) {
	if (/production-master|marketing-walkthrough|journey-[ab]-\d{2}\.jpe?g/i.test(file)) {
		errors.push(`${file}: source-only marketing media leaked into dist`);
	}
}

const stylesheet = await readFile(new URL('../src/styles/global.css', import.meta.url), 'utf8');
if (!/\.product-video-toggle\s*\{[\s\S]*?min-height:\s*4[4-9]px/.test(stylesheet)) {
	errors.push('global.css: product video control is smaller than 44px');
}

if (errors.length) {
	throw new Error(`Site validation failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
}

console.log(`Validated ${htmlFiles.length} HTML pages, ${requiredFiles.length} required assets and real marketing media.`);
