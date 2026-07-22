import { access, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
	args.set(process.argv[index], process.argv[index + 1]);
}

const marketingRoot = resolve(
	args.get('--marketing-root') ?? process.env.MARKETING_DEMO_ROOT ?? '',
);
const posterSource = args.get('--poster-source');

if (!marketingRoot || marketingRoot === resolve('')) {
	throw new Error('Pass --marketing-root /path/to/ProgressTrackerMarketingDemo.');
}

const outputDirectory = resolve('src/assets/demo');
await mkdir(outputDirectory, { recursive: true });

const target = {
	width: 1280,
	height: 800,
	eyeX: 0.5,
	eyeY: 0.43,
	eyeDistance: 0.2,
};
const sourceWidth = 1086;
const sourceHeight = 1448;
const firstScale = (target.width * target.eyeDistance) / (0.166 * sourceWidth);

const photos = [
	{
		name: 'first',
		path: join(
			marketingRoot,
			'ProgressTracker/Resources/MarketingDemo/journey-a-01.jpg',
		),
		eyeCenter: { x: 0.534, y: 0.356 },
		scale: firstScale,
		rotation: 0,
	},
	{
		name: 'latest',
		path: join(
			marketingRoot,
			'ProgressTracker/Resources/MarketingDemo/journey-b-18.jpg',
		),
		eyeCenter: { x: 0.638, y: 0.304 },
		scale: firstScale * 1.07097,
		rotation: -8.594,
	},
];

for (const photo of photos) {
	await access(photo.path);
	await alignPhoto(photo, join(outputDirectory, `${photo.name}.jpg`));
}

if (posterSource) {
	await sharp(resolve(posterSource))
		.resize(540, 1174, { fit: 'cover' })
		.webp({ quality: 76, effort: 6 })
		.toFile(resolve('src/assets/video/product-demo-poster.webp'));
}

await buildOpenGraphCard();

async function alignPhoto(photo, outputPath) {
	const scaledWidth = Math.round(sourceWidth * photo.scale);
	const scaledHeight = Math.round(sourceHeight * photo.scale);
	const radians = (photo.rotation * Math.PI) / 180;
	const cosine = Math.cos(radians);
	const sine = Math.sin(radians);
	const rotatedWidth = Math.ceil(
		Math.abs(scaledWidth * cosine) + Math.abs(scaledHeight * sine),
	);
	const rotatedHeight = Math.ceil(
		Math.abs(scaledWidth * sine) + Math.abs(scaledHeight * cosine),
	);
	const eyeBeforeRotation = {
		x: photo.eyeCenter.x * scaledWidth,
		y: photo.eyeCenter.y * scaledHeight,
	};
	const center = { x: scaledWidth / 2, y: scaledHeight / 2 };
	const eyeAfterRotation = {
		x:
			cosine * (eyeBeforeRotation.x - center.x)
			- sine * (eyeBeforeRotation.y - center.y)
			+ rotatedWidth / 2,
		y:
			sine * (eyeBeforeRotation.x - center.x)
			+ cosine * (eyeBeforeRotation.y - center.y)
			+ rotatedHeight / 2,
	};
	const left = Math.round(eyeAfterRotation.x - target.width * target.eyeX);
	const top = Math.round(eyeAfterRotation.y - target.height * target.eyeY);

	if (
		left < 0
		|| top < 0
		|| left + target.width > rotatedWidth
		|| top + target.height > rotatedHeight
	) {
		throw new Error(`${photo.name} alignment crop falls outside the transformed image.`);
	}

	await sharp(photo.path)
		.resize(scaledWidth, scaledHeight, { fit: 'fill' })
		.rotate(photo.rotation, { background: '#efecea' })
		.extract({ left, top, width: target.width, height: target.height })
		.jpeg({ quality: 92, chromaSubsampling: '4:4:4', mozjpeg: true })
		.toFile(outputPath);
}

async function roundedScreenshot(path, width) {
	const height = Math.round((width * 2622) / 1206);
	const mask = Buffer.from(`
		<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
			<rect width="${width}" height="${height}" rx="${Math.round(width * 0.1)}" fill="white"/>
		</svg>
	`);
	return sharp(path)
		.resize(width, height, { fit: 'fill' })
		.composite([{ input: mask, blend: 'dest-in' }])
		.png()
		.toBuffer();
}

async function buildOpenGraphCard() {
	const home = await roundedScreenshot(resolve('src/assets/screens/home.png'), 226);
	const compare = await roundedScreenshot(resolve('src/assets/screens/compare.png'), 226);
	const icon = await sharp(resolve('src/assets/app-icon.png'))
		.resize(78, 78)
		.png()
		.toBuffer();
	const latest = await sharp(join(outputDirectory, 'latest.jpg'))
		.resize(680, 630, { fit: 'cover' })
		.modulate({ saturation: 0.82, brightness: 1.03 })
		.toBuffer();
	const homeTilted = await sharp(home)
		.rotate(-3.2, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
		.png()
		.toBuffer();
	const compareTilted = await sharp(compare)
		.rotate(4.2, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
		.png()
		.toBuffer();
	const overlay = Buffer.from(`
		<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
			<defs>
				<linearGradient id="fade" x1="0" x2="1">
					<stop offset="0.43" stop-color="#f8f6f3"/>
					<stop offset="0.66" stop-color="#f8f6f3" stop-opacity=".78"/>
					<stop offset="1" stop-color="#f8f6f3" stop-opacity=".08"/>
				</linearGradient>
				<filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
					<feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#241b26" flood-opacity=".24"/>
				</filter>
			</defs>
			<rect width="1200" height="630" fill="url(#fade)"/>
			<circle cx="178" cy="74" r="190" fill="#f0d7aa" opacity=".34"/>
			<circle cx="430" cy="590" r="240" fill="#dfebff" opacity=".58"/>
			<rect x="64" y="62" width="94" height="94" rx="28" fill="white" opacity=".82"/>
			<text x="64" y="226" font-family="-apple-system, BlinkMacSystemFont, Arial" font-size="72" font-weight="760" letter-spacing="-4" fill="#0b0b0d">PhotoDays</text>
			<text x="68" y="294" font-family="-apple-system, BlinkMacSystemFont, Arial" font-size="30" font-weight="650" fill="#29262d">See the progress you miss</text>
			<text x="68" y="334" font-family="-apple-system, BlinkMacSystemFont, Arial" font-size="30" font-weight="650" fill="#29262d">day to day.</text>
			<rect x="66" y="390" width="338" height="54" rx="27" fill="#17151d"/>
			<text x="235" y="425" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, Arial" font-size="19" font-weight="700" fill="white">Capture · Compare · Create</text>
			<rect x="648" y="42" width="248" height="542" rx="44" fill="#070708" filter="url(#shadow)"/>
			<rect x="878" y="46" width="248" height="542" rx="44" fill="#070708" filter="url(#shadow)"/>
		</svg>
	`);

	await mkdir(dirname(resolve('public/og.png')), { recursive: true });
	await sharp({
		create: {
			width: 1200,
			height: 630,
			channels: 4,
			background: '#f8f6f3',
		},
	})
		.composite([
			{ input: latest, left: 520, top: 0 },
			{ input: overlay, left: 0, top: 0 },
			{ input: icon, left: 72, top: 70 },
			{ input: homeTilted, left: 659, top: 52 },
			{ input: compareTilted, left: 884, top: 58 },
		])
		.png({ compressionLevel: 9, palette: true })
		.toFile(resolve('public/og.png'));
}
