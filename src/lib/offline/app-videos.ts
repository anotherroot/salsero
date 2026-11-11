/*
 * The Android app's gallery originals (offline phase 4c part 2): the page asks
 * the app on `window.SalsaVideos` (android/…/VideosBridge.kt) with JSON
 * `{op, id, ...}` and matches the answer by `id`; an upload's progress comes as
 * `{event, file, pct}`. No bridge (an app before 1.10, a browser): null, and
 * the page adds videos as before.
 */
export type Picked = { file: string; mime: string; size: number; name: string };
export type HeldOriginal = { file: string; size: number; readable: boolean };
export type UploadEvent = {
	event: 'progress' | 'done' | 'failed' | 'waiting';
	file: string;
	pct: number | null;
};

type Bridge = {
	postMessage(data: string): void;
	onmessage: ((e: { data: string }) => void) | null;
};

export type AppVideos = {
	pick(multiple: boolean, userId: string): Promise<Picked[] | null>;
	held(userId: string): Promise<HeldOriginal[] | null>;
	upload(kind: 'recording' | 'lesson-video', rowId: number, file: string): Promise<boolean>;
	forget(file: string, gallery: boolean): Promise<{ ok: boolean; deleted: boolean } | null>;
	space(): Promise<{ free: number; gallery: number } | null>;
	on(listener: (e: UploadEvent) => void): () => void;
};

const made = new WeakMap<object, AppVideos>();

/** `wait`: how long an answer may take (a picker waits on the person: long). */
export function appVideosOn(scope: { SalsaVideos?: unknown }, wait = 30_000): AppVideos | null {
	const bridge = scope.SalsaVideos as Bridge | undefined;
	if (!bridge || typeof bridge.postMessage !== 'function') return null;
	const ready = made.get(bridge);
	if (ready) return ready;
	const waiting = new Map<string, (body: Record<string, unknown> | null) => void>();
	const listeners = new Set<(e: UploadEvent) => void>();
	let seq = 0;
	bridge.onmessage = (e) => {
		let body: Record<string, unknown>;
		try {
			body = JSON.parse(e.data) as Record<string, unknown>;
		} catch {
			return;
		}
		if (typeof body.event === 'string') {
			for (const l of listeners) l(body as unknown as UploadEvent);
			return;
		}
		const id = String(body.id ?? '');
		const done = waiting.get(id);
		if (done) {
			waiting.delete(id);
			done(body);
		}
	};
	const ask = (op: string, args: object, ms = wait): Promise<Record<string, unknown> | null> =>
		new Promise((resolve) => {
			const id = `v${++seq}`;
			const timer = setTimeout(() => {
				waiting.delete(id);
				resolve(null);
			}, ms);
			waiting.set(id, (body) => {
				clearTimeout(timer);
				resolve(body);
			});
			bridge.postMessage(JSON.stringify({ op, id, ...args }));
		});
	const app: AppVideos = {
		// The picker waits on the person: an hour, not half a minute.
		pick: async (multiple, userId) =>
			((await ask('pick', { multiple, userId }, 3_600_000))?.files as Picked[] | undefined) ?? null,
		held: async (userId) =>
			((await ask('held', { userId }))?.files as HeldOriginal[] | undefined) ?? null,
		upload: async (kind, rowId, file) =>
			(await ask('upload', { kind, rowId, file }))?.queued === true,
		forget: async (file, gallery) => {
			const r = await ask('forget', { file, gallery }, 600_000);
			return r ? { ok: r.ok === true, deleted: r.deleted === true } : null;
		},
		space: async () => {
			const r = await ask('space', {});
			return r && typeof r.free === 'number' && typeof r.gallery === 'number'
				? { free: r.free, gallery: r.gallery }
				: null;
		},
		on(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		}
	};
	made.set(bridge, app);
	return app;
}

/** This page's app bridge, or null. */
export function appVideos(): AppVideos | null {
	return typeof window === 'undefined' ? null : appVideosOn(window as { SalsaVideos?: unknown });
}

/** Resolves when the app's upload of the file lands (true) or fails (false). Listen before queueing it. */
export function uploadEnd(app: AppVideos, file: string): Promise<boolean> {
	return new Promise((resolve) => {
		const off = app.on((e) => {
			if (e.file !== file || (e.event !== 'done' && e.event !== 'failed')) return;
			off();
			resolve(e.event === 'done');
		});
	});
}
