/**
 * What a figure's page derives for display. PURE and client-safe.
 */
import { fold } from '$lib/fold';
import { longDayLabel } from '$lib/format';
import { t } from '$lib/i18n/catalog';
import type { MetaPart } from '$lib/exercises/today';
import { COUNTS_PER_EIGHT, isLengthCounts, MAX_LENGTH_COUNTS } from '$lib/graph/timing';
import type { MenuItem } from '$lib/menu';
import { parseLink, youtubeWatch } from '$lib/links';
import type { LinkRow } from '$lib/types';
import type { RoutineUse } from '$lib/routines/coverage';
import type { ScheduleState } from '$lib/schedule/schedule';
import { dueWords } from '$lib/schedule/words';

/** "Slot 3 of 6", "Slots 2 and 5 of 8", "Slots 1, 4 and 6 of 9". */
export function routineUseMeta(u: Pick<RoutineUse, 'slots' | 'slotCount'>): string {
	const { slots, slotCount } = u;
	const w = t().figure.relations;
	return slots.length === 1 ? w.slot(slots[0], slotCount) : w.slots(slots, slotCount);
}

/**
 * The one line the figure page shows for its exercise: where it stands in its
 * schedule ("New", "Done today", "Due Sunday"). Derived from the
 * sets, never stored. A paused exercise is not due at all: it says so.
 */
export function practiceLine(
	state: ScheduleState | null,
	today: string,
	neverDone: boolean,
	active = true
): MetaPart | null {
	if (!state) return null;
	const w = t().figure.practice;
	if (!neverDone && state.lastDay === today) return { text: w.doneToday, tone: 'done' };
	if (!active) return { text: w.paused, tone: null };
	return dueWords(state, today, neverDone)[0];
}

/**
 * The facts card's timing: "Starts on 1 · 16 counts", and in a lighter weight
 * " · 2 eights" (whole eights past one) or " · one 8-count".
 */
export function timingLine(
	start: number,
	length: number,
	more: { counts?: number[]; free?: boolean } = {}
): { main: string; extra: string } {
	const w = t().figure.timing;
	const extra =
		length === 8 ? w.oneEight : length % 8 === 0 && length > 8 ? w.eights(length / 8) : '';
	const counts = more.counts ?? [start];
	// Spec 2026-11-11: several start counts, or a length set in the routine.
	if (counts.length > 1 || more.free) {
		const starts = startsLine(counts);
		return more.free
			? { main: `${starts} · ${w.youChoose}`, extra: '' }
			: { main: `${starts} · ${w.counts(length)}`, extra };
	}
	return { main: w.line(start, length), extra };
}

/** "Starts on 1", "Starts on 1 or 5", "Starts on 1, 3 or 5", "Starts on any count". */
export function startsLine(counts: number[]): string {
	const w = t().figure.timing;
	if (counts.length === COUNTS_PER_EIGHT) return w.anyCount;
	if (counts.length === 1) return w.starts(String(counts[0]));
	return w.starts(
		`${counts.slice(0, -1).join(', ')} ${t().figure.or} ${counts[counts.length - 1]}`
	);
}

/**
 * The Archive sheet's title and button, and the caption under the page's
 * Archive button. The last variation takes its figure with it.
 */
export function archiveCopy(
	figure: string,
	variation: string,
	last: boolean
): { title: string; button: string; caption: string } {
	const w = t().figure.archive;
	return last
		? {
				title: w.title(variation),
				button: w.buttonLast,
				caption: `${w.captionLast(figure, variation)} ${w.kept}`
			}
		: {
				title: w.title(variation),
				button: w.button(variation),
				caption: `${w.caption(figure, variation)} ${w.kept}`
			};
}

/** A recording's day: "Wednesday, 28 October", with ", 2025" when it is not this year. */
export function recordingDay(day: string, today: string): string {
	const year = day.slice(0, 4);
	return year === today.slice(0, 4)
		? longDayLabel(day)
		: t().figure.recordings.dayWithYear(longDayLabel(day), year);
}

/**
 * Where a variation sits among its siblings: ‹ and › wrap, and with one
 * variation there is nowhere to step. An unknown id counts as the first.
 */
export function variationNav(
	siblings: { id: number }[],
	currentId: number
): { index: number; count: number; prev: number | null; next: number | null; position: string } {
	const count = siblings.length;
	const index = Math.max(
		0,
		siblings.findIndex((s) => s.id === currentId)
	);
	const step = (by: number) => (count > 1 ? siblings[(index + by + count) % count].id : null);
	return {
		index,
		count,
		prev: step(-1),
		next: step(1),
		position: t().figure.switcher.position(index + 1, count)
	};
}

/**
 * What Move to… shows for the destination typed so far: the button's words, a
 * live name clash (compared trimmed and case-insensitive, as the server does)
 * and whether the button is disabled.
 */
export function moveState(i: {
	last: boolean;
	chosen: { name: string; variations: string[] } | null;
	joinName: string;
}): { cta: string; danger: boolean; clash: string | null; blocked: boolean } {
	const wanted = i.joinName.trim().toLowerCase();
	const clashes =
		i.chosen !== null && i.chosen.variations.some((v) => v.trim().toLowerCase() === wanted);
	const w = t().figure.moveTo;
	return {
		cta: i.last ? w.ctaLast : i.chosen ? w.ctaTo(i.chosen.name) : w.ctaOwn,
		danger: i.last,
		clash: clashes && i.chosen ? w.clash(i.chosen.name, i.joinName.trim()) : null,
		blocked: i.chosen !== null && (wanted === '' || clashes)
	};
}

/**
 * The Counts field's live check: a whole number from 1 to 64, else the message
 * under the field. It never blocks Save; the server decides.
 */
export function lengthError(value: string): string | null {
	const v = value.trim();
	return /^\d+$/.test(v) && isLengthCounts(Number(v))
		? null
		: t().figure.length.error(MAX_LENGTH_COUNTS);
}

/** The delete question's body: which recording, and the saved sections that go with it. */
export function deleteRecordingBody(day: string, size: string, sections: number): string {
	const w = t().figure.recordings;
	return w.deleteBody(day, size, w.sectionsGo(sections));
}

/** The figure page's band subtitle: "Figure · starts on 1 · 16 counts", or "Figure". */
export function figureSubtitle(
	f: {
		startCount: number | null;
		lengthCounts: number | null;
	},
	team?: string
): string {
	const w = t().figure.subtitle;
	const lead = team ? w.teamFigure(team) : w.figure;
	if (f.startCount === null || f.lengthCounts === null) return lead;
	return w.timing(lead, f.startCount, f.lengthCounts);
}

/** What the top of the page plays: the first section, else the first video recording, else nothing. */
export type TopVideo<S, R> =
	{ kind: 'section'; section: S } | { kind: 'recording'; recording: R } | null;

export function topVideo<S, R extends { id: number; kind: 'video' | 'audio' }>(
	sections: S[],
	recordings: R[],
	/** Recordings whose file is missing or will not play here: never the top video. */
	broken: ReadonlySet<number> = new Set()
): TopVideo<S, R> {
	if (sections.length > 0) return { kind: 'section', section: sections[0] };
	const video = recordings.find((r) => r.kind === 'video' && !broken.has(r.id));
	return video ? { kind: 'recording', recording: video } : null;
}

/** "Recordings", or "Recordings · 3" with sections and recordings counted together. */
export function recordingsTitle(n: number): string {
	const w = t().figure.recordings;
	return n === 0 ? w.title : w.titleCount(n);
}

/** A variation's recordings in the switcher's list: "no recordings", "3 recordings". */
export function recordingsLine(n: number): string {
	return n === 0 ? t().figure.recordings.none : t().nouns.recordings(n);
}

/** A recording row's meta: "Video · 24 MB", "From YouTube · 24 MB" for a saved one. */
export function recordingMetaLine(
	kind: 'video' | 'audio',
	size: string,
	fromYouTube = false
): string {
	const w = t().figure.recordings;
	const what = fromYouTube ? w.fromYouTube : kind === 'video' ? w.video : w.audio;
	return `${what} · ${size}`;
}

/** The add sheet's Video from the phone while a video goes up: one upload at a time. */
export function addVideoRow(uploading: boolean): { disabled: boolean; meta: string | null } {
	return uploading
		? { disabled: true, meta: t().figure.recordings.waitUpload }
		: { disabled: false, meta: null };
}

/** An editor always sees Recordings (it holds + Add); a reader only when there is something in it. */
export function showRecordings(i: { canEdit: boolean; items: number }): boolean {
	return i.canEdit || i.items > 0;
}

export type RelationKey = 'follows' | 'leads' | 'routines';

/** The three rows' labels, in the reader's language: read at call time. */
function relationLabel(key: RelationKey): string {
	return t().figure.relations[key];
}

/** The card of three rows: each with its count, an empty one "None" and not opening. */
export function relationRows(c: {
	follows: number;
	leads: number;
	routines: number;
}): { key: RelationKey; label: string; count: string; opens: boolean }[] {
	const none = t().figure.relations.none;
	return (['follows', 'leads', 'routines'] as const).map((key) => ({
		key,
		label: relationLabel(key),
		count: c[key] === 0 ? none : String(c[key]),
		opens: c[key] > 0
	}));
}

/** A row's sheet title: "Follows from", "Leads to", "In 10 routines". */
export function relationTitle(key: RelationKey, n: number): string {
	return key === 'routines' ? t().figure.relations.inRoutines(n) : relationLabel(key);
}

/** Routines that loop first, then by name. */
export function sortRoutines<T extends { name: string; loops: boolean }>(uses: T[]): T[] {
	return [...uses].sort(
		(a, b) =>
			Number(b.loops) - Number(a.loops) ||
			a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
	);
}

/** The sheet's search: every word, accents and case folded, somewhere in the row's name. */
export function filterRows<T extends { name: string }>(rows: T[], q: string): T[] {
	const words = fold(q).split(/\s+/).filter(Boolean);
	if (words.length === 0) return rows;
	return rows.filter((r) => {
		const name = fold(r.name);
		return words.every((w) => name.includes(w));
	});
}

/**
 * The figure page's own ⋯ items (rework plan 2), before slot 3's copy items:
 * Its exercise or Create exercise, History, Move to another move…, and Archive
 * (a danger item, so `orderMenu` lists it last). A reader creates nothing here:
 * their pinned bar has Practise.
 */
export function figureMenuItems(
	i: {
		canEdit: boolean;
		reader: boolean;
		practisable: boolean;
		exercise: { href: string; line: string } | null;
		historyHref: string | null;
		variationName: string;
		/** Create exercise is on its way: left out, so a second tap cannot send it again. */
		creating?: boolean;
	},
	on: { create: () => void; move: () => void; archive: () => void }
): MenuItem[] {
	const w = t().figure.menu;
	const items: MenuItem[] = [];
	if (i.exercise) {
		items.push({
			key: 'exercise',
			icon: 'today',
			label: w.exercise,
			meta: i.exercise.line,
			href: i.exercise.href
		});
	} else if (i.practisable && !i.reader && !i.creating) {
		items.push({
			key: 'create',
			icon: 'plus',
			label: w.create,
			meta: w.createMeta,
			onclick: on.create
		});
	}
	if (i.historyHref)
		items.push({ key: 'history', icon: 'clock', label: w.history, href: i.historyHref });
	if (i.canEdit) {
		items.push({
			key: 'moveFigure',
			icon: 'move-to',
			label: w.move,
			meta: w.moveMeta,
			onclick: on.move
		});
		items.push({
			key: 'archive',
			icon: 'trash',
			label: w.archive(i.variationName),
			danger: true,
			onclick: on.archive
		});
	}
	return items;
}

/** Recordings' count: its sections, recordings and links together. */
export function recordingsCount(i: {
	sections: number;
	recordings: number;
	links: number;
}): number {
	return i.sections + i.recordings + i.links;
}

/**
 * A link as a row of Recordings (rework plan 3, option B): its title, the line
 * under it (a failed save in danger), where a tap goes, and what ends the row —
 * Save for a YouTube link an editor can save, Retry when its save failed, else
 * the external icon.
 */
export function linkRowView(
	link: Pick<LinkRow, 'url' | 'title' | 'saving'>,
	canSave: boolean
): {
	youtube: boolean;
	title: string;
	meta: string;
	failed: boolean;
	href: string | null;
	end: 'save' | 'retry' | 'open' | 'none';
} {
	const parsed = parseLink(link.url);
	// Only what parseLink accepts is ever drawn as a link ($lib/links): an old row that does not parse is text.
	if (!parsed) {
		return {
			youtube: false,
			title: link.title ?? link.url,
			meta: link.url,
			failed: false,
			href: null,
			end: 'none'
		};
	}
	if (parsed.kind === 'web') {
		return {
			youtube: false,
			title: link.title ?? parsed.host,
			meta: parsed.host,
			failed: false,
			href: link.url,
			end: 'open'
		};
	}
	const href = youtubeWatch(parsed.id, parsed.start);
	const w = t().figure.links;
	const title = link.title ?? 'YouTube';
	// A save is the editor's business: a reader, who cannot save or retry, sees the link only.
	if (!canSave)
		return { youtube: true, title, meta: 'youtube.com', failed: false, href, end: 'open' };
	if (link.saving?.status === 'queued') {
		return { youtube: true, title, meta: w.saving, failed: false, href, end: 'open' };
	}
	if (link.saving?.status === 'failed') {
		return {
			youtube: true,
			title,
			meta: w.failed(link.saving.error ?? w.unknownError),
			failed: true,
			href,
			end: 'retry'
		};
	}
	return {
		youtube: true,
		title,
		meta: 'youtube.com',
		failed: false,
		href,
		end: 'save'
	};
}
