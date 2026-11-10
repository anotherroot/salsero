/*
 * Videos kept on the phone, as the page shows them (offline phase 4b). PURE,
 * client-safe: everything comes from the worker's `KeepStatus`.
 */
import { byteSize } from '$lib/format';
import { t } from '$lib/i18n/catalog';
import { mediaOf, VIDEO_KINDS } from './media-store';
import type { KeepStatus, OriginalRow, SpaceId, SpaceRow } from './protocol';

export type VideoKeep =
	| { state: 'off' }
	/** Coming, or in line to come (0). */
	| { state: 'coming'; percent: number }
	| { state: 'waiting'; why: 'wifi' | 'offline' | 'space' }
	| { state: 'on' }
	/** On the phone because a switched-on space keeps it: the switch is what keeps it. */
	| { state: 'space'; space: SpaceId; name: string | null };

/** The button under the video at `src`; null where it has none (no store, not a video). */
export function videoKeep(status: KeepStatus | null, src: string): VideoKeep | null {
	const m = mediaOf(src);
	if (!status || !m || !VIDEO_KINDS.includes(m.kind)) return null;
	const key = `${m.kind}/${m.file}`;
	const space = status.bySpace[key];
	if (status.held.includes(key)) {
		if (space === undefined) return { state: 'on' };
		return { state: 'space', space, name: status.spaces.find((s) => s.id === space)?.name ?? null };
	}
	if (status.inFlight?.key === key) {
		const { received, total } = status.inFlight;
		return { state: 'coming', percent: total > 0 ? Math.floor((received / total) * 100) : 0 };
	}
	if (space !== undefined || status.settings.videos.includes(key)) {
		return status.waiting
			? { state: 'waiting', why: status.waiting }
			: { state: 'coming', percent: 0 };
	}
	return { state: 'off' };
}

/** Whether every one of a lesson's videos is on the phone (and it has one). */
export function lessonOnPhone(status: KeepStatus | null, files: string[]): boolean {
	if (!status || files.length === 0) return false;
	return files.every((f) => status.held.includes(`lesson-videos/${f}`));
}

export type SpaceLine = {
	/** A word before the line in its own colour: on this phone, waiting for Wi-Fi… */
	mark: { text: string; tone: 'done' | 'warn' } | null;
	text: string;
	/** How far the space has come, 0–1, while it comes. */
	bar: number | null;
};

/** A space's line under its switch. */
export function spaceLine(row: SpaceRow, status: KeepStatus): SpaceLine {
	const w = t().settings.onPhone;
	const all = w.videos(row.videos, byteSize(row.bytes));
	if (!row.on || row.videos === 0) return { mark: null, text: all, bar: null };
	if (row.held >= row.videos)
		return { mark: { text: w.onPhone, tone: 'done' }, text: all, bar: null };
	const flight = status.inFlight;
	// What cut-off downloads of this space already have (the one coming counts its own).
	let parts = 0;
	for (const [k, n] of Object.entries(status.partial ?? {})) {
		if (status.bySpace[k] === row.id && k !== flight?.key) parts += n;
	}
	if (flight && status.bySpace[flight.key] === row.id) {
		const got = row.heldBytes + parts + flight.received;
		return {
			mark: null,
			text: w.coming(row.held + 1, row.videos, byteSize(got), byteSize(row.bytes)),
			bar: row.bytes > 0 ? Math.min(1, got / row.bytes) : 0
		};
	}
	const why = status.waiting;
	const mark = why
		? {
				text: why === 'wifi' ? w.waitingWifi : why === 'space' ? w.noSpace : w.waitingNet,
				tone: 'warn' as const
			}
		: null;
	const got = row.heldBytes + parts;
	// Waiting keeps the bar where it was: what came stays on the phone and goes on from there.
	const bar = row.bytes > 0 && got > 0 ? Math.min(1, got / row.bytes) : null;
	return { mark, text: w.ofOnPhone(row.held, row.videos), bar };
}

export type Suggestion =
	| { kind: 'space'; id: SpaceId; name: string | null; videos: number; bytes: number }
	| { kind: 'video'; key: string; title: string; index: number | null; bytes: number }
	/** A person's own video kept only here (offline phase 4c): Upload first, or, uploaded, take it off. */
	| ({ kind: 'original' } & OriginalRow);

/**
 * What to take off the phone when space is short, largest first: a switched-on
 * space (its videos on the phone), or a video kept by itself. A kept video its
 * space also keeps frees nothing, so it is left out.
 */
export function suggestions(status: KeepStatus): Suggestion[] {
	const out: Suggestion[] = [
		...status.spaces
			.filter((s) => s.on && s.heldBytes > 0)
			.map((s): Suggestion => ({
				kind: 'space',
				id: s.id,
				name: s.name,
				videos: s.held,
				bytes: s.heldBytes
			})),
		...status.kept
			.filter((k) => k.held && status.bySpace[k.key] === undefined)
			.map((k): Suggestion => ({
				kind: 'video',
				key: k.key,
				title: k.title,
				index: k.index,
				bytes: k.bytes
			})),
		...(status.originalRows ?? []).map((o): Suggestion => ({ kind: 'original', ...o }))
	];
	return out.sort((a, b) => b.bytes - a.bytes);
}

/** Settings' row: songs, kept videos, and what is free. */
export function phoneRowLine(status: KeepStatus): string {
	return t().settings.onPhone.row(
		byteSize(status.bytes.songs),
		byteSize(status.bytes.videos),
		status.free === null ? null : byteSize(status.free)
	);
}

/** The words after a video's size: on this phone, how far it has come, or what it waits for. */
export function keepWord(
	k: VideoKeep | null
): { text: string; tone: 'done' | 'muted' | 'warn' } | null {
	const w = t().settings.onPhone;
	if (!k || k.state === 'off') return null;
	if (k.state === 'on' || k.state === 'space') return { text: w.onPhone, tone: 'done' };
	if (k.state === 'coming') return { text: w.comingShort(k.percent), tone: 'muted' };
	const text = k.why === 'wifi' ? w.waitingWifi : k.why === 'space' ? w.noSpace : w.waitingNet;
	return { text, tone: 'warn' };
}
