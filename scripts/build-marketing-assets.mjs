import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
	args.set(process.argv[index], process.argv[index + 1]);
}

const progressPosterSource = required('--progress-poster');
const productPosterSource = required('--product-poster');
const sequenceRoot = args.get('--sequence-root');
const productSource = args.get('--product-source');

await access(progressPosterSource);
await access(productPosterSource);
await mkdir(resolve('src/assets/video'), { recursive: true });

await sharp(progressPosterSource)
	.resize(720, 900, { fit: 'cover' })
	.webp({ quality: 76, effort: 6 })
	.toFile(resolve('src/assets/video/progress-film-poster.webp'));

await sharp(productPosterSource)
	.resize(720, 1566, { fit: 'cover' })
	.webp({ quality: 73, effort: 6 })
	.toFile(resolve('src/assets/video/product-demo-poster.webp'));

await buildOpenGraphCard();
await writeProvenance();

function required(name) {
	const value = args.get(name);
	if (!value) throw new Error(`Missing ${name}.`);
	return resolve(value);
}

async function sha256(path) {
	return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function roundedScreenshot(path, width) {
	const height = Math.round((width * 2622) / 1206);
	const mask = Buffer.from(`
		<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
			<rect width="${width}" height="${height}" rx="${Math.round(width * 0.11)}" fill="white"/>
		</svg>
	`);
	return sharp(path)
		.resize(width, height, { fit: 'fill' })
		.composite([{ input: mask, blend: 'dest-in' }])
		.png()
		.toBuffer();
}

async function buildOpenGraphCard() {
	const home = await roundedScreenshot(resolve('src/assets/screens/home.png'), 238);
	const icon = await sharp(resolve('src/assets/app-icon.png')).resize(82, 82).png().toBuffer();
	const latest = await sharp(resolve('src/assets/demo/day-365.jpg'))
		.resize(610, 630, { fit: 'cover', position: 'center' })
		.modulate({ saturation: 0.9, brightness: 1.02 })
		.toBuffer();
	const homeTilted = await sharp(home)
		.rotate(-3.5, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
		.png()
		.toBuffer();
	const overlay = Buffer.from(`
		<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
			<defs>
				<linearGradient id="fade" x1="0" x2="1">
					<stop offset=".42" stop-color="#f7f2e9"/>
					<stop offset=".63" stop-color="#f7f2e9" stop-opacity=".82"/>
					<stop offset="1" stop-color="#f7f2e9" stop-opacity=".04"/>
				</linearGradient>
				<filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
					<feDropShadow dx="0" dy="20" stdDeviation="20" flood-color="#241b18" flood-opacity=".28"/>
				</filter>
			</defs>
			<rect width="1200" height="630" fill="url(#fade)"/>
			<circle cx="96" cy="26" r="210" fill="#e4bd70" opacity=".25"/>
			<circle cx="510" cy="620" r="290" fill="#bad8ea" opacity=".34"/>
			<rect x="58" y="50" width="98" height="98" rx="30" fill="white" opacity=".82"/>
			<text x="58" y="226" font-family="-apple-system, BlinkMacSystemFont, Arial" font-size="68" font-weight="760" letter-spacing="-4" fill="#11100f">See the change</text>
			<text x="58" y="300" font-family="-apple-system, BlinkMacSystemFont, Arial" font-size="68" font-weight="760" letter-spacing="-4" fill="#11100f">you’re too close</text>
			<text x="58" y="374" font-family="-apple-system, BlinkMacSystemFont, Arial" font-size="68" font-weight="760" letter-spacing="-4" fill="#11100f">to notice.</text>
			<text x="60" y="430" font-family="-apple-system, BlinkMacSystemFont, Arial" font-size="21" font-weight="650" fill="#5f5953">A private visual progress journal for iPhone and iPad.</text>
			<rect x="58" y="478" width="220" height="50" rx="25" fill="#11100f"/>
			<text x="168" y="510" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, Arial" font-size="17" font-weight="700" fill="#fffdfa">PhotoDays</text>
			<rect x="850" y="38" width="260" height="570" rx="48" fill="#070708" filter="url(#shadow)"/>
		</svg>
	`);

	await sharp({
		create: {
			width: 1200,
			height: 630,
			channels: 4,
			background: '#f7f2e9',
		},
	})
		.composite([
			{ input: latest, left: 590, top: 0 },
			{ input: overlay, left: 0, top: 0 },
			{ input: icon, left: 66, top: 58 },
			{ input: homeTilted, left: 861, top: 48 },
		])
		.png({ compressionLevel: 9, palette: true })
		.toFile(resolve('public/og.png'));
}

async function writeProvenance() {
	const sourcePhotos = [];
	if (sequenceRoot) {
		const names = (await readdir(resolve(sequenceRoot)))
			.filter((name) => /\.png$/i.test(name))
			.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
		for (const name of names) {
			const path = resolve(sequenceRoot, name);
			sourcePhotos.push({ id: name.slice(0, 2), file: basename(name), sha256: await sha256(path) });
		}
	}

	const screens = {};
	for (const name of [
		'home',
		'progress',
		'gallery',
		'camera',
		'compare',
		'video',
		'reminder',
		'privacy',
		'chart-date-elapsed',
		'chart-duration',
		'chart-mood-trend',
		'chart-year-activity',
		'achievements-profile',
		'achievements-grid',
		'share',
	]) {
		screens[`${name}.png`] = await sha256(resolve(`src/assets/screens/${name}.png`));
	}

	const websiteScreenSources = {
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
	};

	const output = {
		schemaVersion: 3,
		generatedAt: '2026-07-30T00:00:00Z',
		sources: {
			photoSequence: {
				label: 'PhotoDays_sequence_01-35',
				ids: sourcePhotos.map(({ id }) => id),
				files: sourcePhotos,
			},
			productRecording: productSource ? {
				file: basename(productSource),
				sha256: await sha256(resolve(productSource)),
				durationSeconds: 25.1,
				dimensions: '1206x2622',
			} : null,
		},
		transformations: {
			photoAlignment: {
				detector: 'Apple Vision VNDetectFaceLandmarksRequest',
				eyeMidpointCoreImage: [0.5, 0.64],
				visibleEyeMidpoint: [0.5, 0.36],
				eyeDistance: 0.24,
				rollNormalized: true,
				outputDimensions: '1280x1600',
				publishedPhotos: ['01', '35'],
			},
			progressFilm: {
				sourceIds: sourcePhotos.map(({ id }) => id),
				durationSeconds: 4.4,
				dimensions: '720x900',
				codec: 'H.264/AVC',
				frameRate: 30,
				audioTracks: 0,
				fastStart: true,
			},
			productDemo: {
				operation: 'The first 0.3 seconds are replaced with the clean Home frame sampled at 0.35 seconds.',
				durationSeconds: 25.1,
				dimensions: '720x1566',
				codec: 'H.264/AVC',
				frameRate: 30,
				audioTracks: 0,
				fastStart: true,
				extractedScreens: {
					'share.png': screens['share.png'],
				},
			},
			websiteScreens: {
				source: 'ProgressTrackerMarketingDemo deterministic captures',
				captureDate: '2026-07-25T12:00:00+03:00',
				dimensions: '1206x2622',
				sourceFiles: websiteScreenSources,
				publishedScreens: screens,
			},
		},
		outputs: {
			day1: await sha256(resolve('src/assets/demo/day-1.jpg')),
			day365: await sha256(resolve('src/assets/demo/day-365.jpg')),
			progressFilm: await sha256(resolve('public/media/photodays-progress-film.mp4')),
			progressPoster: await sha256(resolve('src/assets/video/progress-film-poster.webp')),
			productDemo: await sha256(resolve('public/media/photodays-product-demo.mp4')),
			productPoster: await sha256(resolve('src/assets/video/product-demo-poster.webp')),
			openGraph: await sha256(resolve('public/og.png')),
		},
	};

	await writeFile(resolve('public/media/provenance.json'), `${JSON.stringify(output, null, 2)}\n`);
}
