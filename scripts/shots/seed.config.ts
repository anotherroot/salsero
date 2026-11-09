// Vitest runs the rig's seed (seed-class.ts) with the app's own data functions,
// so `$lib` and `$env` resolve as they do in the specs. Used by seed.sh only.
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['scripts/shots/seed-class.ts', 'scripts/shots/seed-suggestions.ts'],
		environment: 'node',
		testTimeout: 120_000
	}
});
