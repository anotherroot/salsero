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

/** Whether a page path is a network page (`NETWORK_PAGES`): the device never draws it. */
export function isNetworkPage(path: string): boolean {
	return networkPages.some((re) => re.test(path));
}

/** Whether the device may answer this request from its copy. */
export function deviceAnswers(method: string, url: URL): boolean {
	if (method !== 'GET') return false;
	const path = url.pathname;
	if (path.endsWith(DATA)) {
		return !isNetworkPage(path.slice(0, -DATA.length) || '/');
	}
	return deviceEndpoints.some((re) => re.test(path));
}

/*
 * Every write, classified (offline phase 3):
 * - device: runs on the device first, online or offline, and syncs;
 * - queued: the same, with the Waiting badge until it lands (the server does a part);
 * - network: needs the server (blocked offline, "Needs a connection");
 * - pass (endpoints): the service worker never touches it (the sync itself, uploads).
 * The rule for a new one: a person's own content, or their group's they edit,
 * is device; what changes several people's things at once, needs an answer
 * now, sets a browser cookie or a media file is network. `routes.spec.ts`
 * fails on an unclassified action or endpoint write.
 */
export type WriteClass = 'device' | 'queued' | 'network';

/** Every form action, by route id, then action name ('default' for a default action). */
export const ACTIONS: Readonly<Record<string, Readonly<Record<string, WriteClass>>>> = {
	'/[dance]/(moves)/coverage': {
		create: 'device'
	},
	'/[dance]/(moves)/figures': {
		create: 'device'
	},
	'/[dance]/(moves)/figures/[id]': {
		addLink: 'device',
		archive: 'device',
		copyTo: 'network',
		createVariation: 'device',
		deleteLink: 'device',
		deleteRecording: 'network',
		detach: 'network',
		drop: 'network',
		keep: 'device',
		linkSection: 'device',
		makeMine: 'network',
		move: 'device',
		practise: 'device',
		retryVideo: 'queued',
		sameAs: 'device',
		saveVideo: 'queued',
		separate: 'device',
		sync: 'network',
		takeRecording: 'network',
		unlinkSection: 'device',
		update: 'device'
	},
	'/[dance]/(moves)/moves/[id]': {
		createFigure: 'device',
		rename: 'device'
	},
	'/[dance]/(moves)/positions': {
		create: 'device',
		templates: 'device'
	},
	'/[dance]/(moves)/positions/[id]': {
		archive: 'device',
		copyTo: 'network',
		detach: 'network',
		drop: 'network',
		keep: 'device',
		linkLesson: 'device',
		linkSpot: 'device',
		makeMine: 'network',
		restore: 'device',
		sameAs: 'device',
		separate: 'device',
		sync: 'network',
		unlinkLesson: 'device',
		unlinkSpot: 'device',
		update: 'device'
	},
	'/[dance]/(moves)/positions/map': {
		routine: 'device'
	},
	'/[dance]/(moves)/routines': {
		create: 'device'
	},
	'/[dance]/(moves)/routines/[id]': {
		addOption: 'device',
		addSong: 'device',
		archive: 'device',
		copyTo: 'network',
		deleteMany: 'device',
		detach: 'network',
		drop: 'network',
		duplicate: 'device',
		duplicateMany: 'device',
		extract: 'device',
		insert: 'device',
		keep: 'device',
		makeMine: 'network',
		note: 'device',
		noteSong: 'device',
		removeOption: 'device',
		removeSong: 'device',
		rename: 'device',
		reorder: 'device',
		restore: 'device',
		restoreOption: 'device',
		sameAs: 'device',
		separate: 'device',
		sync: 'network'
	},
	'/[dance]/(today)': {
		createExercise: 'device',
		done: 'device',
		next: 'device',
		pick: 'device',
		undoDone: 'device',
		unpick: 'device',
		warmupOrder: 'device'
	},
	'/[dance]/(today)/exercises/[id]': {
		add: 'device',
		addDrill: 'device',
		addLink: 'device',
		addSong: 'device',
		archive: 'device',
		copyTo: 'network',
		deleteDay: 'device',
		deleteLink: 'device',
		detach: 'network',
		done: 'device',
		drop: 'network',
		keep: 'device',
		linkSection: 'device',
		makeMine: 'network',
		noteSong: 'device',
		removeSong: 'device',
		restoreDay: 'device',
		sync: 'network',
		unlinkSection: 'device',
		update: 'device'
	},
	'/[dance]/group-mode': {
		default: 'network'
	},
	'/[dance]/groups': {
		create: 'network',
		joinCode: 'network'
	},
	'/[dance]/groups/[id]': {
		add: 'device',
		addNow: 'device',
		autoAdd: 'device',
		createDrill: 'device',
		createLesson: 'device',
		delete: 'network',
		leave: 'network',
		remakeCode: 'network',
		rename: 'device',
		restore: 'network'
	},
	'/[dance]/groups/[id]/deleted': {
		restore: 'network'
	},
	'/[dance]/groups/[id]/history/[kind]/[rootId]': {
		restore: 'network'
	},
	'/[dance]/groups/[id]/people': {
		handOver: 'network',
		remove: 'network',
		role: 'network'
	},
	'/[dance]/groups/[id]/storage': {
		ask: 'network',
		deleteRecording: 'network',
		deleteVideo: 'network'
	},
	'/[dance]/lessons': {
		create: 'device'
	},
	'/[dance]/lessons/[id]': {
		add: 'device',
		addLink: 'device',
		addSong: 'device',
		archive: 'device',
		copyTo: 'network',
		deleteLink: 'device',
		deleteVideo: 'network',
		detach: 'network',
		drop: 'network',
		keep: 'device',
		linkExercise: 'device',
		linkFigure: 'device',
		linkPosition: 'device',
		linkRoutine: 'device',
		makeMine: 'network',
		moveTo: 'network',
		newExercise: 'device',
		newFigure: 'device',
		newPosition: 'device',
		newRoutine: 'device',
		newVariation: 'device',
		notNow: 'device',
		noteSong: 'device',
		publish: 'queued',
		remove: 'device',
		removeSong: 'device',
		retryVideo: 'queued',
		sameAs: 'device',
		saveVideo: 'queued',
		separate: 'device',
		sync: 'network',
		unlinkExercise: 'device',
		unlinkFigure: 'device',
		unlinkPosition: 'device',
		unlinkRoutine: 'device',
		update: 'device'
	},
	'/[dance]/share': {
		create: 'network'
	},
	'/[dance]/songs': {
		addUrl: 'queued',
		dismissImport: 'network',
		retry: 'queued',
		retryImport: 'network'
	},
	'/[dance]/songs/[id]': {
		archive: 'device',
		audio: 'network',
		copyTo: 'network',
		delete: 'network',
		detach: 'network',
		drop: 'network',
		keep: 'device',
		makeMine: 'network',
		one: 'device',
		removeAnchor: 'device',
		resetAnchors: 'device',
		restore: 'device',
		retry: 'queued',
		sameAs: 'device',
		sample: 'device',
		sampleAuto: 'device',
		sectionAdd: 'device',
		sectionEdit: 'device',
		sectionMove: 'device',
		sectionRemove: 'device',
		sectionsClear: 'device',
		separate: 'device',
		share: 'device',
		start: 'device',
		startFound: 'device',
		startZero: 'device',
		sync: 'network',
		tap: 'device',
		tempo: 'device',
		unshare: 'device',
		update: 'device'
	},
	'/[dance]/songs/imports/[id]': {
		add: 'network',
		dismiss: 'network'
	},
	'/admin': {
		decline: 'network',
		grant: 'network',
		invite: 'network',
		setGroupLimit: 'network',
		setLimit: 'network',
		setLocale: 'network',
		setTeamLimit: 'network'
	},
	'/device/pair': {
		default: 'network'
	},
	'/g/[code]': {
		join: 'network'
	},
	'/join': {
		default: 'network'
	},
	'/login': {
		default: 'network'
	},
	'/settings': {
		ask: 'network',
		dailyCount: 'device',
		language: 'network',
		level: 'device',
		name: 'device',
		reminder: 'device',
		removeDevice: 'network',
		restoreDevice: 'network',
		style: 'device',
		theme: 'network',
		videoSize: 'device'
	},
	'/settings/storage': {
		deleteRecording: 'network',
		deleteSong: 'network',
		deleteVideo: 'network'
	},
	'/voice': {
		delete: 'network',
		restore: 'network'
	},
	'/welcome': {
		default: 'network'
	},
	'/welcome/start': {
		join: 'network',
		level: 'device',
		skip: 'device'
	}
};

type WriteMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';
/** Every endpoint write, by route id, then method. 'pass': the service worker never handles it. */
export const ENDPOINT_WRITES: Readonly<
	Record<string, Readonly<Partial<Record<WriteMethod, WriteClass | 'pass'>>>>
> = {
	'/[dance]/(today)/exercises/[id]/practice': { POST: 'device' },
	'/api/archived': { POST: 'device' },
	'/api/comments/[id]': { DELETE: 'queued' },
	'/api/comments/[id]/heart': { POST: 'queued' },
	'/api/comments/[id]/restore': { POST: 'queued' },
	'/api/count-takes': { POST: 'network' },
	'/api/figures/[id]/recordings': { POST: 'pass' },
	'/api/lessons/[id]/comments': { POST: 'queued' },
	'/api/lessons/[id]/videos/[uploadId]': { PUT: 'pass' },
	'/api/opens': { POST: 'device' },
	'/api/positions': { POST: 'device' },
	'/api/songs': { POST: 'pass' },
	'/api/sync/pull': { POST: 'pass' },
	'/api/sync/push': { POST: 'pass' },
	'/api/trash/[id]': { POST: 'network' },
	'/api/video-spots': { POST: 'device' },
	'/api/video-spots/[id]': { DELETE: 'device', PATCH: 'device' },
	'/api/video-spots/[id]/links': { POST: 'device' },
	'/api/video-spots/[id]/links/[linkId]': { DELETE: 'device' },
	'/api/worker/claim': { POST: 'network' },
	'/api/worker/imports/[id]/fail': { POST: 'network' },
	'/api/worker/imports/[id]/items': { POST: 'network' },
	'/api/worker/imports/claim': { POST: 'network' },
	'/api/worker/songs/[id]/analysis': { POST: 'network' },
	'/api/worker/songs/[id]/audio': { PUT: 'network' },
	'/api/worker/songs/[id]/fail': { POST: 'network' },
	'/api/worker/songs/[id]/start': { POST: 'network' },
	'/api/worker/videos/[id]/fail': { POST: 'network' },
	'/api/worker/videos/[id]/file': { PUT: 'network' },
	'/api/worker/videos/claim': { POST: 'network' },
	'/logout': { POST: 'network' }
};

const staticSegments = (id: string) =>
	id.split('/').filter((s) => s && !s.startsWith('[') && !s.startsWith('(')).length;
const patterns = new Map<string, RegExp>();
const patternOf = (id: string) => {
	let re = patterns.get(id);
	if (!re) patterns.set(id, (re = routePattern(id)));
	return re;
};

/** The route id among `ids` a path matches: the one with the most static segments. Null: none. */
export function matchRoute(path: string, ids: readonly string[]): string | null {
	let best: string | null = null;
	for (const id of ids) {
		if (!patternOf(id).test(path)) continue;
		if (best === null || staticSegments(id) > staticSegments(best)) best = id;
	}
	return best;
}

const ACTION_IDS = Object.keys(ACTIONS);
const ENDPOINT_IDS = Object.keys(ENDPOINT_WRITES);

/** A write's class; null for a GET, an unknown route or action (treated as network). */
export function writeClass(method: string, url: URL): WriteClass | 'pass' | null {
	const m = method.toUpperCase();
	if (m === 'GET' || m === 'HEAD') return null;
	const path = url.pathname;
	// The sync itself: never through the device.
	if (path.startsWith('/api/sync/')) return 'pass';
	const endpoint = matchRoute(path, ENDPOINT_IDS);
	if (endpoint !== null) return ENDPOINT_WRITES[endpoint][m as WriteMethod] ?? null;
	const page = m === 'POST' ? matchRoute(path, ACTION_IDS) : null;
	if (page !== null) {
		const name = [...url.searchParams.keys()].find((k) => k.startsWith('/'))?.slice(1) ?? 'default';
		return ACTIONS[page][name] ?? null;
	}
	return isNetworkPage(path) ? 'network' : null;
}
