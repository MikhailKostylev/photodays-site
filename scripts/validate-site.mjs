import { createHash } from 'node:crypto';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const dist = new URL('../dist/', import.meta.url);
const distPath = fileURLToPath(dist);
const errors = [];
const canonicalPages = ['/', '/photo-diary/', '/progress-photos/', '/photo-progress-video/', '/privacy/', '/terms/', '/support/'];
const redirects = new Map([
	['ru/index.html', '/'],
	['ru/privacy/index.html', '/privacy/'],
	['ru/terms/index.html', '/terms/'],
	['ru/support/index.html', '/support/'],
]);
const requiredFiles = [
	'index.html',
	'photo-diary/index.html',
	'progress-photos/index.html',
	'photo-progress-video/index.html',
	'privacy/index.html',
	'terms/index.html',
	'support/index.html',
	...redirects.keys(),
	'404.html',
	'sitemap.xml',
	'robots.txt',
	'CNAME',
	'googleacb1539d6b9becef.html',
	'og.png',
	'media/photodays-product-demo.mp4',
	'media/photodays-progress-film.mp4',
	'media/provenance.json',
];

for (const file of requiredFiles) await access(new URL(file, dist));

const htmlFiles = [];
const distFiles = [];
async function collectFiles(directory, relative = '') {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const nextRelative = join(relative, entry.name);
		if (entry.isDirectory()) await collectFiles(join(directory, entry.name), nextRelative);
		if (entry.isFile()) {
			distFiles.push(nextRelative);
			if (entry.name.endsWith('.html')) htmlFiles.push(nextRelative);
		}
	}
}
await collectFiles(distPath);

for (const file of htmlFiles) {
	const html = await readFile(new URL(file, dist), 'utf8');
 if (/^google[a-f0-9]+\.html$/.test(file)) {
  if (html.trim() !== `google-site-verification: ${file}`) errors.push(`${file}: invalid Google verification file`);
  continue;
 }
	if (html.includes('href="#"')) errors.push(`${file}: placeholder link found`);
	if (!html.includes('rel="canonical"')) errors.push(`${file}: canonical URL missing`);
	if (!html.includes('name="viewport"')) errors.push(`${file}: viewport metadata missing`);
	if (/hreflang=["']ru/i.test(html)) errors.push(`${file}: Russian hreflang remains`);
	if (/language-link|>RU</.test(html)) errors.push(`${file}: language switch remains`);
	if (/[А-Яа-яЁё]/.test(html)) errors.push(`${file}: Russian copy remains`);
	for (const image of html.matchAll(/<img[^>]*>/gi)) {
		if (!/\balt(?:=|\s|>)/i.test(image[0])) errors.push(`${file}: image without alt text`);
	}

	for (const match of html.matchAll(/href="([^"]+)"/gi)) {
		const href = decodeHtml(match[1]);
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

const sitemap = await readFile(new URL('sitemap.xml', dist), 'utf8');
const sitemapLocations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const expectedLocations = canonicalPages.map((path) => new URL(path, 'https://photodays.app').toString());
if (JSON.stringify(sitemapLocations) !== JSON.stringify(expectedLocations)) {
	errors.push(`sitemap.xml: expected only ${expectedLocations.join(', ')}, received ${sitemapLocations.join(', ')}`);
}
if (sitemap.includes('/ru/') || sitemap.includes('hreflang')) {
	errors.push('sitemap.xml: legacy locale markup remains');
}

for (const [file, target] of redirects) {
	const html = await readFile(new URL(file, dist), 'utf8');
	const canonical = new URL(target, 'https://photodays.app').toString();
	if (!html.includes('name="robots" content="noindex, follow"')) errors.push(`${file}: noindex redirect metadata missing`);
	if (!html.includes(`rel="canonical" href="${canonical}"`)) errors.push(`${file}: English canonical target missing`);
	if (
		!html.includes(`const target = "${target}"`)
		|| !html.includes('window.location.replace(target)')
	) {
		errors.push(`${file}: client redirect target is incorrect`);
	}
	if (!html.includes(`href="${target}"`)) errors.push(`${file}: fallback English link missing`);
}

const home = await readFile(new URL('index.html', dist), 'utf8');
// Validate the public document contract instead of freezing marketing wording.
const titles = new Set();
const descriptions = new Set();
const headings = new Set();
const pageData = new Map();
const configSource = await readFile(new URL('../src/config.ts', import.meta.url), 'utf8');
const configuredStore = configSource.match(/appStoreUrl:\s*(['"])(.*?)\1/)?.[2] ?? null;
if (configuredStore && configuredStore !== 'https://apps.apple.com/app/id6811136068') errors.push('src/config.ts: unexpected App Store destination');
for (const route of canonicalPages) {
 const file = route === '/' ? 'index.html' : `${route.slice(1)}index.html`;
 const html = await readFile(new URL(file, dist), 'utf8');
 const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
 const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
 const h1s = [...html.matchAll(/<h1(?:\s[^>]*)?>([\s\S]*?)<\/h1>/g)];
 const heading = h1s[0]?.[1].replace(/<[^>]*>/g, '').trim();
 for (const [value, seen, label] of [[title, titles, 'title'], [description, descriptions, 'description'], [heading, headings, 'H1']]) {
  if (!value || seen.has(value)) errors.push(`${file}: missing or duplicate ${label}`);
  seen.add(value);
 }
 if (h1s.length !== 1) errors.push(`${file}: expected one H1`);
 if (/name="robots"[^>]*noindex/i.test(html)) errors.push(`${file}: canonical page is noindex`);
 if (html.includes('name="keywords"')) errors.push(`${file}: unnecessary meta keywords`);
 const canonical = new URL(route, 'https://photodays.app').toString();
 if (!html.includes(`rel="canonical" href="${canonical}"`)) errors.push(`${file}: incorrect canonical`);
 for (const value of ['property="og:title"', 'property="og:description"', 'property="og:image"', 'name="twitter:card"']) {
  if (!html.includes(value)) errors.push(`${file}: missing ${value}`);
 }
 if (!html.includes(`property="og:url" content="${canonical}"`)) errors.push(`${file}: incorrect Open Graph URL`);
 if (!html.includes('id="main-content"')) errors.push(`${file}: skip-link target is missing`);
 if (!configuredStore && /https:\/\/(?:www\.)?apps\.apple\.com/.test(html)) errors.push(`${file}: download link present while release URL is null`);
 if (configuredStore && /class="[^"]*store-cta/.test(html) && !html.includes(`href="${configuredStore}"`)) errors.push(`${file}: configured download link is missing`);
 const schemas = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => {
  try { return JSON.parse(match[1]); } catch { errors.push(`${file}: malformed JSON-LD`); return {}; }
 });
 if (route === '/' && !schemas.some(schema => schema['@type'] === 'SoftwareApplication')) errors.push(`${file}: app schema missing`);
 if (['/photo-diary/', '/progress-photos/', '/photo-progress-video/'].includes(route)) {
  const breadcrumb = schemas.find(schema => schema['@type'] === 'BreadcrumbList');
  if (breadcrumb?.itemListElement?.[1]?.item !== canonical) errors.push(`${file}: breadcrumb schema missing or incorrect`);
  if ((html.match(/<details>/g) ?? []).length < 4) errors.push(`${file}: topic FAQ missing`);
  if (!html.includes('class="topic-steps"') || !html.includes('class="topic-limits"')) errors.push(`${file}: workflow or limitations missing`);
 }
 pageData.set(route, html);
}
for (const [route, html] of pageData) {
 for (const match of html.matchAll(/href="([^" ]*#[^" ]+)"/g)) {
  const href = decodeHtml(match[1]);
  if (!href.startsWith('/') && !href.startsWith('#')) continue;
  const [path, id] = href.split('#');
  const target = pageData.get(path || route);
  if (target && !target.includes(`id="${id}"`)) errors.push(`${route}: broken fragment ${href}`);
 }
}
const notFound = await readFile(new URL('404.html', dist), 'utf8');
if (!notFound.includes('noindex')) errors.push('404.html: noindex is missing');
if (!configuredStore && !home.includes('Coming soon on the App Store')) errors.push('index.html: release status is missing');
if (configuredStore && home.includes('Coming soon on the App Store')) errors.push('index.html: stale release status');
for (const requiredVideoMarkup of [
	'data-compare-surface',
	'data-compare-separator',
	'role="slider"',
	'tabindex="0"',
	'preload="none"',
	'muted',
	'playsinline',
	'data-src="/media/photodays-progress-film.mp4"',
	'data-src="/media/photodays-product-demo.mp4"',
	'data-product-video-toggle',
]) {
	if (!home.includes(requiredVideoMarkup)) errors.push(`index.html: missing interactive markup ${requiredVideoMarkup}`);
}

const stylesheet = await readFile(new URL('../src/styles/global.css', import.meta.url), 'utf8');
if (!/\.compare-reveal-media\s*\{[\s\S]*?touch-action:\s*pan-y/.test(stylesheet)) {
 errors.push('global.css: comparison must preserve vertical touch scrolling');
}
if (!stylesheet.includes('prefers-reduced-motion: reduce')) errors.push('global.css: reduced motion support missing');
const support = await readFile(new URL('support/index.html', dist), 'utf8');
for (const value of [
	'mailto:support@photodays.app',
	'PhotoDays%20Support%20Request',
	'PhotoDays%20Bug%20Report',
	'app settings',
]) {
	if (!support.includes(value)) errors.push(`support/index.html: missing ${value}`);
}
if (support.includes('your account settings')) errors.push('support/index.html: stale account-settings copy remains');

for (const [name, dimensions] of Object.entries({
	home: [1206, 2622],
	progress: [1206, 2622],
	camera: [1206, 2622],
	compare: [1206, 2622],
	gallery: [1206, 2622],
	video: [1206, 2622],
	reminder: [1206, 2622],
	privacy: [1206, 2622],
	'chart-date-elapsed': [1206, 2622],
	'chart-duration': [1206, 2622],
	'chart-mood-trend': [1206, 2622],
	'chart-year-activity': [1206, 2622],
	'achievements-profile': [1206, 2622],
	'achievements-grid': [1206, 2622],
	share: [1206, 2622],
})) {
	await checkImage(new URL(`../src/assets/screens/${name}.png`, import.meta.url), dimensions, `${name}.png`);
}
for (const name of ['day-1', 'day-365']) {
	await checkImage(new URL(`../src/assets/demo/${name}.jpg`, import.meta.url), [1280, 1600], `${name}.jpg`);
}
await checkImage(new URL('../src/assets/video/progress-film-poster.webp', import.meta.url), [720, 900], 'progress film poster', 100_000);
await checkImage(new URL('../src/assets/video/product-demo-poster.webp', import.meta.url), [720, 1566], 'product video poster', 140_000);
await checkImage(new URL('og.png', dist), [1200, 630], 'og.png');

await checkVideo('media/photodays-progress-film.mp4', [720, 900], 2_500_000, [4, 6]);
await checkVideo('media/photodays-product-demo.mp4', [720, 1566], 6_000_000, [24.8, 25.3]);

const provenance = JSON.parse(await readFile(new URL('media/provenance.json', dist), 'utf8'));
if (provenance.schemaVersion !== 3) errors.push('media/provenance.json: schema version 3 missing');
if (provenance.sources?.photoSequence?.ids?.length !== 35) errors.push('media/provenance.json: 35 source photo IDs missing');
const websiteScreens = provenance.transformations?.websiteScreens;
if (Object.keys(websiteScreens?.publishedScreens ?? {}).length !== 15) {
	errors.push('media/provenance.json: fifteen published website screen checksums missing');
}
for (const [publishedName, sourceName] of Object.entries({
	'home.png': '01-home-365-days.png',
	'progress.png': '03-progress-18-days.png',
	'gallery.png': '04-gallery-camera-roll.png',
	'camera.png': '05-camera-face-alignment.png',
	'compare.png': '06-compare-split.png',
	'video.png': '09-video-ready.png',
	'reminder.png': '10-reminder-enabled.png',
	'privacy.png': '11-privacy-settings.png',
	'chart-date-elapsed.png': 'Charts-and-Achievements/chart-date-elapsed.png',
	'chart-duration.png': 'Charts-and-Achievements/chart-duration.png',
	'chart-mood-trend.png': 'Charts-and-Achievements/chart-mood-trend.png',
	'chart-year-activity.png': 'Charts-and-Achievements/chart-year-activity.png',
	'achievements-profile.png': 'Charts-and-Achievements/streak-profile.png',
	'achievements-grid.png': 'Charts-and-Achievements/achievements-grid.png',
})) {
	if (websiteScreens?.sourceFiles?.[publishedName] !== sourceName) {
		errors.push(`media/provenance.json: ${publishedName} source mapping is incorrect`);
	}
	const path = new URL(`../src/assets/screens/${publishedName}`, import.meta.url);
	const actual = createHash('sha256').update(await readFile(path)).digest('hex');
	if (websiteScreens?.publishedScreens?.[publishedName] !== actual) {
		errors.push(`media/provenance.json: ${publishedName} checksum mismatch`);
	}
}
const shareScreenshot = await readFile(new URL('../src/assets/screens/share.png', import.meta.url));
const shareChecksum = createHash('sha256').update(shareScreenshot).digest('hex');
if (
	websiteScreens?.publishedScreens?.['share.png'] !== shareChecksum
	|| provenance.transformations?.productDemo?.extractedScreens?.['share.png'] !== shareChecksum
) {
	errors.push('media/provenance.json: share.png checksum mismatch');
}
if (!provenance.transformations?.productDemo?.operation?.includes('first 0.3 seconds')) {
	errors.push('media/provenance.json: clean Home-frame replacement is undocumented');
}
if (JSON.stringify(provenance).includes('/Users/')) errors.push('media/provenance.json: personal filesystem path leaked');
for (const [key, path] of Object.entries({
	day1: new URL('../src/assets/demo/day-1.jpg', import.meta.url),
	day365: new URL('../src/assets/demo/day-365.jpg', import.meta.url),
	progressFilm: new URL('media/photodays-progress-film.mp4', dist),
	progressPoster: new URL('../src/assets/video/progress-film-poster.webp', import.meta.url),
	productDemo: new URL('media/photodays-product-demo.mp4', dist),
	productPoster: new URL('../src/assets/video/product-demo-poster.webp', import.meta.url),
	openGraph: new URL('og.png', dist),
})) {
	const actual = createHash('sha256').update(await readFile(path)).digest('hex');
	if (provenance.outputs?.[key] !== actual) errors.push(`media/provenance.json: ${key} checksum mismatch`);
}

const transcodeSource = await readFile(new URL('../scripts/transcode-product-video.swift', import.meta.url), 'utf8');
if (!transcodeSource.includes('CMTime(seconds: 0.35') || !transcodeSource.includes('CMTime(seconds: 0.3')) {
	errors.push('transcode-product-video.swift: clean Home-frame replacement settings missing');
}

for (const file of distFiles) {
 if (file.startsWith('qa-')) errors.push(`${file}: local QA fixture leaked into publication`);
	if (
		/production.*master|trial.*recap|onboarding_trial|\.m4v$/i.test(file)
		|| /(?:^|\/)\d{2}_original_\d{2}\.png$/i.test(file)
		|| /PhotoDays_sequence_01-35/i.test(file)
		|| /first\.(?:jpg|png)|latest\.(?:jpg|png)/i.test(file)
		|| /(?:^|\/)\d{2}-(?:home|progress|gallery|camera|compare|video|reminder|privacy)-[^/]+\.png$/i.test(file)
	) {
		errors.push(`${file}: source, recap or superseded placeholder media leaked into dist`);
	}
}

if (errors.length) {
	throw new Error(`Site validation failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
}

console.log(`Validated ${htmlFiles.length} HTML pages, seven canonical routes, legacy redirects and real PhotoDays media.`);

function decodeHtml(value) {
	return value.replaceAll('&amp;', '&');
}

async function checkImage(url, dimensions, label, maxBytes = Infinity) {
	const path = fileURLToPath(url);
	const metadata = await sharp(path).metadata();
	const stats = await stat(path);
	if (metadata.width !== dimensions[0] || metadata.height !== dimensions[1]) {
		errors.push(`${label}: expected ${dimensions.join('x')}, received ${metadata.width}x${metadata.height}`);
	}
	if (stats.size > maxBytes) errors.push(`${label}: exceeds ${maxBytes} bytes (${stats.size})`);
}

async function checkVideo(relative, dimensions, maxBytes, durationRange) {
	const url = new URL(relative, dist);
	const path = fileURLToPath(url);
	const buffer = await readFile(path);
	const stats = await stat(path);
	if (stats.size > maxBytes) errors.push(`${relative}: exceeds ${maxBytes} bytes (${stats.size})`);
	if (!buffer.includes(Buffer.from('avc1'))) errors.push(`${relative}: H.264/AVC marker missing`);
	if (buffer.includes(Buffer.from('soun'))) errors.push(`${relative}: audio track must not ship`);

	const atoms = topLevelAtoms(buffer);
	const moov = atoms.find((atom) => atom.type === 'moov');
	const mdat = atoms.find((atom) => atom.type === 'mdat');
	if (!moov || !mdat || moov.offset > mdat.offset) errors.push(`${relative}: moov atom does not precede mdat`);

	const tracks = findTrackDimensions(buffer);
	if (!tracks.some(([width, height]) => width === dimensions[0] && height === dimensions[1])) {
		errors.push(`${relative}: expected ${dimensions.join('x')} video track, received ${JSON.stringify(tracks)}`);
	}
	const duration = movieDuration(buffer);
	if (!(duration >= durationRange[0] && duration <= durationRange[1])) {
		errors.push(`${relative}: duration ${duration.toFixed(2)}s is outside ${durationRange.join('–')}s`);
	}
}

function topLevelAtoms(buffer) {
	const atoms = [];
	let offset = 0;
	while (offset + 8 <= buffer.length) {
		let size = buffer.readUInt32BE(offset);
		const type = buffer.toString('ascii', offset + 4, offset + 8);
		let header = 8;
		if (size === 1 && offset + 16 <= buffer.length) {
			size = Number(buffer.readBigUInt64BE(offset + 8));
			header = 16;
		}
		if (size === 0) size = buffer.length - offset;
		if (size < header || offset + size > buffer.length) break;
		atoms.push({ type, offset, size });
		offset += size;
	}
	return atoms;
}

function findTrackDimensions(buffer) {
	const dimensions = [];
	let searchFrom = 0;
	while (searchFrom < buffer.length) {
		const marker = buffer.indexOf('tkhd', searchFrom, 'ascii');
		if (marker < 4) break;
		const offset = marker - 4;
		const size = buffer.readUInt32BE(offset);
		if (size >= 88 && offset + size <= buffer.length) {
			const width = buffer.readUInt32BE(offset + size - 8) / 65536;
			const height = buffer.readUInt32BE(offset + size - 4) / 65536;
			if (width > 0 && height > 0) dimensions.push([Math.round(width), Math.round(height)]);
		}
		searchFrom = marker + 4;
	}
	return dimensions;
}

function movieDuration(buffer) {
	const marker = buffer.indexOf('mvhd', 0, 'ascii');
	if (marker < 4) return NaN;
	const offset = marker - 4;
	const version = buffer[offset + 8];
	if (version === 1) {
		const timescale = buffer.readUInt32BE(offset + 28);
		const duration = Number(buffer.readBigUInt64BE(offset + 32));
		return duration / timescale;
	}
	const timescale = buffer.readUInt32BE(offset + 20);
	const duration = buffer.readUInt32BE(offset + 24);
	return duration / timescale;
}
