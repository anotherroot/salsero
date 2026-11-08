/**
 * The fetch side of `POST /[dance]/exercises/[id]/practice`: remember what an
 * exercise is practised with, for next time. Used by the popup's panel and the
 * full player, on every change of a setting (before a run or during one), not
 * only on Play. A convenience: a failure changes nothing, so it is never
 * awaited and never reported.
 */
import { practiceToPost, type PracticeConfig, type PracticeInput } from './practice';

/** How long the settings must sit still before they are posted: a tempo stepper sends many changes. */
export const SAVE_DELAY_MS = 800;

export interface PracticeChoice {
	source: 'count' | 'song';
	songId: number | null;
	bpm: number;
	config: PracticeConfig;
}

type Post = (url: string, body: PracticeInput) => void;

/** `keepalive`, so a flush from a page being left still reaches the server. */
const postJson: Post = (url, body) => {
	void fetch(url, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
		keepalive: true
	}).catch(() => {});
};

export interface PracticeSaver {
	/** What the server holds as this page knows it: loaded, or posted (or about to be). */
	readonly known: PracticeInput | null;
	/** A setting changed: post it once things settle, if it differs from `known`. */
	change(choice: PracticeChoice): void;
	/** Post a waiting change now (Play, leaving the page). */
	flush(): void;
	/** Newer data loaded: it is what the server holds, unless a change of ours is still waiting. */
	reset(known: PracticeInput | null): void;
}

/**
 * Posts only what differs from `known` (`practiceToPost`), so a page that opens
 * and leaves untouched never writes back a practice that came in while it was
 * open (Keep in step flows a drill's practice).
 */
export function practiceSaver(
	danceSlug: string,
	exerciseId: number,
	known: PracticeInput | null,
	post: Post = postJson
): PracticeSaver {
	let waiting: PracticeInput | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;
	const url = `/${danceSlug}/exercises/${exerciseId}/practice`;

	function flush() {
		if (timer !== null) clearTimeout(timer);
		timer = null;
		if (waiting === null) return;
		const body = waiting;
		waiting = null;
		post(url, body);
	}

	return {
		get known() {
			return known;
		},
		change(choice) {
			const next = practiceToPost(known, choice);
			if (next === null) return;
			known = next;
			waiting = next;
			if (timer !== null) clearTimeout(timer);
			timer = setTimeout(flush, SAVE_DELAY_MS);
		},
		flush,
		reset(loaded) {
			if (waiting === null) known = loaded;
		}
	};
}
