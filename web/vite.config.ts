import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const isVitest = process.env.VITEST === 'true';

export default defineConfig({
	plugins: isVitest ? [] : [sveltekit()]
});
