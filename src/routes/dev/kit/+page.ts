import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/** The kit gallery is a dev tool: it does not exist in a production build. */
export const load: PageLoad = () => {
	if (!dev) error(404, 'Not found');
};
