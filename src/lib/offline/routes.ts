/*
 * Which requests the device answers from its copy (offline phase 2, read
 * only). Route ids as SvelteKit names them. The rule for a new GET endpoint:
 * answerable from synced rows -> device; otherwise -> network.
 */

/** A route id as a pattern for a URL path: `(group)` segments dropped, `[x]` one segment. */
export function routePattern(routeId: string): RegExp {
	const body = routeId
		.split('/')
		.filter((seg) => !/^\(.*\)$/.test(seg))
		.map((seg) =>
			seg
				.split(/(\[[^\]]+\])/)
				.map((part) =>
					/^\[[^\]]+\]$/.test(part) ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
				)
				.join('')
		)
		.join('/');
	return new RegExp(`^${body === '' ? '/?' : body}/?$`);
}

/** Pages the device never answers: they need the server (accounts, storage, group admin, sign-in). */
export const NETWORK_PAGES = [
	'/admin',
	'/login',
	'/join',
	'/app',
	'/device/pair',
	'/g/[code]',
	'/settings/storage',
	'/[dance]/groups/[id]/history/[kind]/[rootId]',
	'/[dance]/groups/[id]/deleted',
	'/[dance]/groups/[id]/people',
	'/[dance]/groups/[id]/storage',
	'/welcome',
	'/dev/kit'
];

/** GET endpoints answerable from synced rows. */
export const DEVICE_ENDPOINTS = [
	'/api/lessons/[id]/comments',
	'/api/video-spots',
	'/api/video-spots/[id]/links',
	'/[dance]/songs/[id]/grid'
];

/** Every other GET endpoint: the server's alone. */
export const NETWORK_ENDPOINTS = [
	'/api/app-update/[dance]',
	'/api/clones/copy',
	'/api/clones/move',
	'/api/clones/sync',
	'/api/device/config',
	'/api/device/today',
	'/api/teams/[id]/keep',
	'/api/worker/songs/[id]/audio',
	'/api/worker/starts',
	'/audio/[file]',
	'/count/[file]',
	'/lesson-videos/[file]',
	'/recordings/[file]',
	'/releases/[dance]/[file]',
	'/health',
	'/manifest-[dance].webmanifest',
	'/.well-known/assetlinks.json'
];

const DATA = '/__data.json';
const networkPages = NETWORK_PAGES.map(routePattern);
const deviceEndpoints = DEVICE_ENDPOINTS.map(routePattern);

/** Whether the device may answer this request from its copy. */
export function deviceAnswers(method: string, url: URL): boolean {
	if (method !== 'GET') return false;
	const path = url.pathname;
	if (path.endsWith(DATA)) {
		const page = path.slice(0, -DATA.length) || '/';
		return !networkPages.some((re) => re.test(page));
	}
	return deviceEndpoints.some((re) => re.test(path));
}
