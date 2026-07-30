// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
	site: 'https://photodays.app',
	output: 'static',
	trailingSlash: 'always',
	compressHTML: true,
});
