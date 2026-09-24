import { error, json } from '@sveltejs/kit';
import { getDance, isDanceSlug } from '$lib/dances/dances';
import type { RequestHandler } from './$types';

/**
 * One manifest per dance, so each installs as its own home-screen app.
 *
 * Served FLAT rather than under `/[dance]/`, on purpose: `PUBLIC_PATHS` in
 * `hooks.server.ts` is an exact-match Set, and keeping these paths literal
 * means the auth gate needs no prefix matching — the one place where a
 * pattern would be a new way to expose a page by accident. A manifest's own
 * location does not have to sit inside its `scope`.
 */
export const GET: RequestHandler = ({ params }) => {
	if (!isDanceSlug(params.dance)) throw error(404);
	const dance = getDance(params.dance);
	return json(
		{
			name: `${dance.label} practice`,
			short_name: dance.label,
			start_url: `/${dance.slug}/`,
			scope: `/${dance.slug}/`,
			display: 'standalone',
			background_color: '#f5f3ef',
			theme_color: dance.accent,
			icons: [
				{ src: `/icons/${dance.slug}-192.png`, sizes: '192x192', type: 'image/png' },
				{ src: `/icons/${dance.slug}-512.png`, sizes: '512x512', type: 'image/png' }
			]
		},
		{ headers: { 'content-type': 'application/manifest+json' } }
	);
};
