/*
 * The page's side of the Android app's gallery originals (offline phase 4c
 * part 2): which the app holds for this person (`appOriginals`, read by
 * `livePlace`), adding videos through the app's picker, Upload through the
 * app's queue (its progress shown on the Where button), and letting one go
 * after its video is deleted (the system then asks about the gallery itself).
 */
import { appVideos } from './app-videos';
import { appOriginals } from './places.svelte';
import { noteUpload } from './uploads.svelte';
import { dropOriginal, kept, syncNow } from './device.svelte';
import { phoneRoute, type AddTarget } from './add-phone';
import { refreshWhenSettled } from '$lib/sheets/history.svelte';

let person: string | null = null;
let listening = false;

/** What the app holds for [userId]; a gallery file gone reads as not held (the row says missing). */
export async function readAppOriginals(userId: string | null): Promise<void> {
	const app = appVideos();
	if (!app || !userId) return;
	person = userId;
	appOriginals.android = true;
	if (!listening) {
		listening = true;
		app.on((e) => {
			if (e.event === 'progress') noteUpload(e.file, e.pct ?? 0);
			else {
				noteUpload(e.file, null);
				if (e.event === 'done') {
					void syncNow();
					void refreshWhenSettled();
				}
			}
		});
	}
	const held = await app.held(userId);
	if (held) appOriginals.files = held.filter((h) => h.readable).map((h) => h.file);
}

/** The app's picker, then each picked video's row (a device write); a refused row is let go. */
export async function addFromApp(
	target: AddTarget,
	multiple: boolean
): Promise<{ added: { id: number; file: string }[]; refused: number }> {
	const app = appVideos();
	if (!app || !person) return { added: [], refused: 0 };
	const picked = (await app.pick(multiple, person)) ?? [];
	const added: { id: number; file: string }[] = [];
	let refused = 0;
	const slot = kept.status?.slot ?? null;
	for (const p of picked) {
		let res: Response | null;
		try {
			res = await fetch(phoneRoute(target), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					file: p.file,
					mime: p.mime,
					sizeBytes: p.size,
					...(slot === null ? {} : { slot })
				})
			});
		} catch {
			res = null;
		}
		const row = res?.ok ? ((await res.json().catch(() => null)) as { id?: number } | null) : null;
		if (row && typeof row.id === 'number') {
			added.push({ id: row.id, file: p.file });
			appOriginals.files = [...appOriginals.files, p.file];
		} else {
			refused++;
			void app.forget(p.file, false);
		}
	}
	return { added, refused };
}

/** Upload through the app (compressed there, in the background); false where the app cannot. */
export async function uploadFromApp(
	table: 'recordings' | 'lesson_videos',
	id: number,
	file: string
): Promise<boolean> {
	const app = appVideos();
	if (!app) return false;
	noteUpload(file, 0);
	const queued = await app.upload(table === 'recordings' ? 'recording' : 'lesson-video', id, file);
	if (!queued) noteUpload(file, null);
	return queued;
}

/** After a phone-only video is deleted: the app lets its original go, and asks about the gallery. */
export async function forgetInApp(file: string): Promise<void> {
	const app = appVideos();
	if (!app) return;
	appOriginals.files = appOriginals.files.filter((f) => f !== file);
	await app.forget(file, true);
}

/** After a phone-only video is deleted: its original goes, wherever this phone holds it. */
export async function letOriginalGo(file: string): Promise<void> {
	if (appOriginals.files.includes(file)) await forgetInApp(file);
	else await dropOriginal(file);
}
