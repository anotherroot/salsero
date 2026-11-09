import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			// An open page asks for `version.json` this often and `updated.current`
			// turns true once a new build is out (`$lib/nav/fresh.ts`). The
			// version's `name` stays SvelteKit's default: the build time.
			version: { pollInterval: 300_000 },
			// Absolute asset URLs: the cached shell (`/shell`) is served at any path
			// offline, and a relative `./_app/…` would resolve under that path.
			paths: { relative: false },
			// The page registers it (`$lib/offline/device.svelte.ts`), in a build only.
			serviceWorker: { register: false },
			typescript: {
				config: (config) => {
					config.include.push('../drizzle.config.ts');
				}
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		// Each `openDb(':memory:')` replays every migration; under load the full
		// suite crossed the 5 s default (src/lib/server/db/timeout.spec.ts).
		testTimeout: 15_000,
		hookTimeout: 15_000,
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
