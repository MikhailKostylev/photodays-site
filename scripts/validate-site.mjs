import { createHash } from 'node:crypto';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const dist = new URL('../dist/', import.meta.url);
const distPath = fileURLToPath(dist);
const errors = [];
const canonicalPages = ['/', '/privacy/', '/terms/', '/support/'];
const redirects = new Map([
	['ru/index.html', '/'],
	['ru/privacy/index.html', '/privacy/'],
	['ru/terms/index.html', '/terms/'],
	['ru/support/index.html', '/support/'],
]);
const requiredFiles = [
	'index.html',
	'privacy/index.html',
	'terms/index.html',
	'support/index.html',
	...redirects.keys(),
	'404.html',
	'sitemap.xml',
	'robots.txt',
	'CNAME',
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
for (const phrase of [
	'See the change you’re too close to notice.',
	'Your memory misses small changes. Your photos don’t.',
	'35 moments. One visible story.',
	'See the whole journey in 25 seconds.',
	'Coming soon on the App Store',
	'Day 1',
	'Day 365',
]) {
	if (!home.includes(phrase)) errors.push(`index.html: missing approved copy “${phrase}”`);
}
if (!home.includes('application/ld+json')) errors.push('index.html: SoftwareApplication data missing');
if (!home.includes('property="og:image"')) errors.push('index.html: Open Graph image metadata missing');
if (home.includes('type="range"')) errors.push('index.html: visible bottom comparison range remains');

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

const compareSource = await readFile(new URL('../src/components/CompareReveal.astro', import.meta.url), 'utf8');
for (const behavior of [
	"'pointerdown'",
	"'pointermove'",
	'setPointerCapture',
	'releasePointerCapture',
	"'ArrowLeft'",
	"'ArrowRight'",
	"'Home'",
	"'End'",
	'event.shiftKey ? 10 : 2',
]) {
	if (!compareSource.includes(behavior)) errors.push(`CompareReveal.astro: missing ${behavior}`);
}
const stylesheet = await readFile(new URL('../src/styles/global.css', import.meta.url), 'utf8');
if (!/\.compare-reveal-media\s*\{[\s\S]*?touch-action:\s*pan-y/.test(stylesheet)) {
	errors.push('global.css: comparison must preserve vertical touch scrolling');
}
if (!/\.compare-reveal-separator\s*\{[\s\S]*?width:\s*56px/.test(stylesheet)) {
	errors.push('global.css: comparison separator touch target is not 56px');
}
if (!/\.media-toggle\s*\{[\s\S]*?min-width:\s*44px[\s\S]*?min-height:\s*44px/.test(stylesheet)) {
	errors.push('global.css: media controls are smaller than 44px');
}

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
	video: [1206, 2622],
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
if (provenance.schemaVersion !== 2) errors.push('media/provenance.json: schema version 2 missing');
if (provenance.sources?.photoSequence?.ids?.length !== 35) errors.push('media/provenance.json: 35 source photo IDs missing');
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
	if (
		/production.*master|trial.*recap|onboarding_trial|\.m4v$/i.test(file)
		|| /(?:^|\/)\d{2}_original_\d{2}\.png$/i.test(file)
		|| /PhotoDays_sequence_01-35/i.test(file)
		|| /first\.(?:jpg|png)|latest\.(?:jpg|png)|reminder\.|settings\./i.test(file)
	) {
		errors.push(`${file}: source, recap or superseded placeholder media leaked into dist`);
	}
}

if (errors.length) {
	throw new Error(`Site validation failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
}

console.log(`Validated ${htmlFiles.length} HTML pages, four canonical routes, legacy redirects and real PhotoDays media.`);

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
