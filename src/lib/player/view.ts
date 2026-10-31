/**
 * What the Practice page shows, derived from what it holds. PURE and
 * client-safe: no DOM, no audio, no clock. The impure player lives in
 * `src/lib/scheduler/attach.ts`; this only decides sizes, words and where
 * Back goes.
 */
import type { Dance, DanceSlug } from '$lib/dances/dances';
import { frequencyLabel } from '$lib/frequency';
import { typeInfo } from '$lib/exercises/kinds';
import { clock } from '$lib/format';
import type { ClavePattern, CountPattern, Source, Speed } from '$lib/labels';
import { chooseTakes } from '$lib/scheduler/attach';
import type { CountTakeRow } from '$lib/types';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

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

export function setupSubtitle(
	routine: { name: string; figureIds: number[] } | null
): string | undefined {
	return routine
		? `${routine.name} · ${plural(routine.figureIds.length, 'figure', 'figures')}`
		: undefined;
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
	const parts = [
		r.routine,
		r.song ? (r.speed === 1 ? null : `${r.speed}×`) : r.bpm === null ? null : `${r.bpm} BPM`,
		dance.clave && r.clave ? `clave ${r.clave}` : null
	].filter((p): p is string => !!p);
	return parts.length ? parts.join(' · ') : undefined;
}

/** The Source switch's two options, shared by Setup and SourcePicker. */
export const SOURCES = [
	{ value: 'count', label: 'Count only' },
	{ value: 'song', label: 'A song' }
];

/** `calls` null: nothing was called, by design. */
export function runSummary(durationS: number, calls: number | null): string {
	return [
		clock(durationS),
		calls === null ? null : `${plural(calls, 'figure', 'figures')} called`,
		'logged as a set'
	]
		.filter((p) => p !== null)
		.join(' · ');
}

export function playState(p: {
	source: 'count' | 'song';
	songId: number | null;
	ready: boolean;
	error: string | null;
	starting: boolean;
}): { disabled: boolean; busy: boolean; label: 'Play' | 'Starting…'; why: string | null } {
	if (p.starting) return { disabled: true, busy: true, label: 'Starting…', why: null };
	if (p.source === 'song') {
		if (p.songId === null) {
			return { disabled: true, busy: false, label: 'Play', why: 'Pick a song first.' };
		}
		// Loading or failed: the loading row and the field's error say why.
		if (!p.ready || p.error) return { disabled: true, busy: false, label: 'Play', why: null };
	}
	return { disabled: false, busy: false, label: 'Play', why: null };
}

/** "Yours" only when a recorded set of this pattern fits the tempo. */
export function voiceKind(
	takes: CountTakeRow[],
	pattern: CountPattern,
	bpm: number | null
): 'Built-in' | 'Yours' {
	if (bpm === null) return 'Built-in';
	return chooseTakes(
		takes.filter((t) => t.pattern === pattern),
		bpm
	) === null
		? 'Built-in'
		: 'Yours';
}

export function exerciseLine(e: { source: Source; everyDays: number }): string {
	return `${typeInfo(e.source).label} · ${frequencyLabel(e.everyDays)}`;
}

/**
 * Where Back goes. Built only from the validated dance slug and numeric ids,
 * and `from` is compared to a literal, never echoed: no open redirect.
 */
export function practiceBack(p: {
	dance: DanceSlug;
	from: string | null;
	routine: { id: number; name: string } | null;
	song: { id: number; title: string } | null;
	exercise: { id: number; name: string } | null;
}): { href: string; label: string } {
	const today = { href: `/${p.dance}`, label: 'Back to Today' };
	if (p.from === 'today') return today;
	if (p.from === 'exercise' && p.exercise) {
		return { href: `/${p.dance}/exercises/${p.exercise.id}`, label: `Back to ${p.exercise.name}` };
	}
	if (p.routine) {
		return { href: `/${p.dance}/routines/${p.routine.id}`, label: `Back to ${p.routine.name}` };
	}
	if (p.song) {
		return { href: `/${p.dance}/songs/${p.song.id}`, label: `Back to ${p.song.title}` };
	}
	if (p.exercise) return today;
	return { href: `/${p.dance}/songs`, label: 'Back to Music' };
}
