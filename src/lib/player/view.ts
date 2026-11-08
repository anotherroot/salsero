/**
 * What the Practice page shows, derived from what it holds. PURE and
 * client-safe: no DOM, no audio, no clock. The impure player lives in
 * `src/lib/scheduler/attach.ts`; this only decides sizes, words and where
 * Back goes.
 */
import type { Dance, DanceSlug } from '$lib/dances/dances';
import { t } from '$lib/i18n/catalog';
import type { ClavePattern, CountPattern, Speed } from '$lib/labels';
import { chooseTakes } from '$lib/scheduler/attach';
import { beatIndexAt } from '$lib/beatgrid/beatgrid';
import type { CountTakeRow } from '$lib/types';

/** The count's disc in px: smaller when a song or a routine shares the screen. */
export function stageSize(hasSong: boolean, hasRoutine: boolean): number {
	if (hasSong && hasRoutine) return 136;
	if (hasSong || hasRoutine) return 176;
	return 230;
}

export function stageDigit(
	count: number | null,
	paused: boolean
): { text: string; disc: boolean; dim: boolean } {
	if (count === null) return { text: '–', disc: false, dim: true };
	return { text: String(count), disc: count === 1 && !paused, dim: paused };
}

export function stageDots(
	count: number | null,
	paused: boolean
): { n: number; size: 10 | 16; tone: 'now' | 'held' | 'beat' | 'quiet' }[] {
	return Array.from({ length: 8 }, (_, i) => {
		const n = i + 1;
		if (n === count)
			return { n, size: 16 as const, tone: paused ? ('held' as const) : ('now' as const) };
		return {
			n,
			size: 10 as const,
			tone: n === 4 || n === 8 ? ('quiet' as const) : ('beat' as const)
		};
	});
}

/**
 * How a routine's list behaves in the run. Follow lights each figure in time
 * with the music (and a tap starts the run there); Still lights nothing and
 * leaves the list to be read. Remembered per routine on the phone.
 */
export type RoutineView = 'follow' | 'still';
/** Follow and Still, in the reader's language, read when asked. */
export function routineViews(): { value: RoutineView; label: string }[] {
	const w = t().player;
	return [
		{ value: 'follow', label: w.follow },
		{ value: 'still', label: w.still }
	];
}

/** The full-screen routine's band line: where the run is ("5 of 16"), or how long the routine is. */
export function routinePlace(active: number | null, total: number): string {
	const w = t().player;
	return active === null ? w.figures(total) : w.routinePlace(active + 1, total);
}

/**
 * The bar under the figure on now: one mark per count up to 16, else one per
 * 8-count, so a long figure's marks stay wide enough to see.
 */
export function stepMarks(lengthCounts: number): { marks: number; per: number } {
	const counts = Math.max(1, Math.round(lengthCounts));
	return counts <= 16 ? { marks: counts, per: 1 } : { marks: Math.ceil(counts / 8), per: 8 };
}

/** How many of those marks are filled: the beats from the figure's "1" to now, the current one included. */
export function stepDone(
	beats: number[],
	startAt: number,
	now: number,
	mark: { marks: number; per: number }
): number {
	const from = beatIndexAt(beats, startAt);
	const at = beatIndexAt(beats, now);
	if (from < 0 || at < from) return 0;
	return Math.min(mark.marks, Math.floor((at - from) / mark.per) + 1);
}

/**
 * A routine row on the run: the slot on now, the ones danced
 * before it (muted), the ones to come. A looping routine back at its first
 * slot has nothing past.
 */
export function slotTone(i: number, active: number | null): 'now' | 'past' | 'next' {
	if (i === active) return 'now';
	if (active !== null && i < active) return 'past';
	return 'next';
}

/** The desktop's heading over the whole routine: where the run is, or how long it is. */
export function routineHeading(active: number | null, total: number): string {
	const w = t().player;
	return active === null ? w.routineSlots(total) : w.routineSlotOf(active + 1, total);
}

/** The running band's title steps down (46 → 30 on desk) past 18 characters or with a word over 10. */
export function runTitleCompact(title: string): boolean {
	return title.length > 18 || title.split(/\s+/).some((w) => w.length > 10);
}

export function setupSubtitle(
	routine: { name: string; figureIds: number[] } | null
): string | undefined {
	return routine ? t().player.routineLine(routine.name, routine.figureIds.length) : undefined;
}

export function runSubtitle(
	r: {
		routine: string | null;
		song: boolean;
		speed: Speed;
		bpm: number | null;
		clave: ClavePattern | null;
	},
	dance: Dance
): string | undefined {
	const panel = t().exercise.panel;
	const parts = [
		r.routine,
		r.song
			? r.speed === 1
				? null
				: panel.speed(r.speed)
			: r.bpm === null
				? null
				: t().player.bpm(r.bpm),
		dance.clave && r.clave ? panel.summaryClave(r.clave) : null
	].filter((p): p is string => !!p);
	return parts.length ? parts.join(' · ') : undefined;
}

/** The Source switch's two options, shared by Setup and SourcePicker. */
export function runSources(): { value: string; label: string }[] {
	const w = t().exercise.panel;
	return [
		{ value: 'count', label: w.countOnly },
		{ value: 'song', label: w.aSong }
	];
}

export function playState(p: {
	source: 'count' | 'song';
	songId: number | null;
	ready: boolean;
	error: string | null;
	starting: boolean;
}): { disabled: boolean; busy: boolean; label: string; why: string | null } {
	const play = t().exercise.panel.play;
	if (p.starting) return { disabled: true, busy: true, label: t().player.starting, why: null };
	if (p.source === 'song') {
		if (p.songId === null) {
			return { disabled: true, busy: false, label: play, why: t().player.pickSongFirst };
		}
		// Loading or failed: the loading row and the field's error say why.
		if (!p.ready || p.error) return { disabled: true, busy: false, label: play, why: null };
	}
	return { disabled: false, busy: false, label: play, why: null };
}

/** "Yours" only when a recorded set of this pattern fits the tempo; the word, in the current language. */
export function voiceKind(
	takes: CountTakeRow[],
	pattern: CountPattern,
	bpm: number | null
): string {
	const w = t().player;
	if (bpm === null) return w.builtIn;
	return chooseTakes(
		takes.filter((take) => take.pattern === pattern),
		bpm
	) === null
		? w.builtIn
		: w.yours;
}

/**
 * The no-opener fallback for Back. The band's back goes to the page Practice was
 * opened from (the trail, `nav/trail.ts`); only a Practice with none recorded
 * (a fresh tab, a reload) uses this, keyed by `?from=`. Built only from the
 * validated dance slug and numeric ids, and `from` is compared to a literal, never echoed: no open redirect.
 */
export function practiceBack(p: {
	dance: DanceSlug;
	from: string | null;
	routine: { id: number; name: string } | null;
	song: { id: number; title: string } | null;
	/** `archived`: its page 404s, so Back cannot go there. */
	exercise: { id: number; name: string; archived?: boolean } | null;
}): { href: string; label: string } {
	const w = t().player;
	const backTo = t().shell.backTo;
	const today = { href: `/${p.dance}`, label: w.backToToday };
	if (p.from === 'today') return today;
	if (p.from === 'exercise' && p.exercise && !p.exercise.archived) {
		return { href: `/${p.dance}/exercises/${p.exercise.id}`, label: backTo(p.exercise.name) };
	}
	if (p.routine) {
		return { href: `/${p.dance}/routines/${p.routine.id}`, label: backTo(p.routine.name) };
	}
	if (p.song) {
		return { href: `/${p.dance}/songs/${p.song.id}`, label: backTo(p.song.title) };
	}
	if (p.exercise) return today;
	return { href: `/${p.dance}/songs`, label: w.backToMusic };
}
