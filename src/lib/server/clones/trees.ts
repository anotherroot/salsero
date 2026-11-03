/**
 * A member of a family as a `Flat`: its synced fields under the key grammar
 * of `$lib/clones/flat.ts`, so two members compare key by key. Never writes:
 * a row (or a piece, or a link target) without a gene reads as `#<id>`.
 *
 * Every root field is always present, and so are the `:note` and `:links`
 * parts of every piece and section, with `''` for an empty value: a missing
 * key means the thing is gone, and an emptied note must read as a change.
 *
 * Local to each place, and so never here: which move a figure is under,
 * `archived_at`, `published_at`, `shared_at`, the owners, entries and their
 * practice settings, logs. A song's audio is the family's, never a field.
 */
import { asc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { CloneKind, Flat } from '$lib/types';
import { fieldLabel } from '$lib/clones/flat';
import { getDance } from '$lib/dances/dances';
import { DEFAULT_LENGTH_COUNTS, DEFAULT_START_COUNT } from '$lib/graph/timing';
import { timingLine } from '$lib/figures/page';
import { localDay } from '$lib/day/day';
import { clock, dateLabel, dayMonth, plural } from '$lib/format';
import { PARTNER_LABEL, TEMPO_LABEL, type Partner, type TempoFactor } from '$lib/labels';
import { spotLabel } from '$lib/video/spots';
import type { Db } from '../db';
import {
	exercises,
	figureGroups,
	figures,
	figureStartPositions,
	lessonExercises,
	lessonFigures,
	lessonRoutines,
	lessons,
	lessonVideos,
	links,
	positions,
	recordings,
	routines,
	routineStepOptions,
	routineSteps,
	songs,
	spotLinks,
	videoSpots
} from '../db/schema';

/** A family member's reference: its gene, or `#<id>` while it is a family of one. */
const ref = (gene: string | null, id: number) => gene ?? `#${id}`;

/** Builds a Flat; `name` is what the label calls the field when it differs from `show`. */
class Builder {
	readonly flat: Flat = {};
	add(key: string, value: string, show: string = value, name: string = show): void {
		this.flat[key] = { key, value, show, label: fieldLabel(key, name) };
	}
}

/** The member as flat fields. Throws for a missing row. */
export function flatOf(db: Db, kind: CloneKind, id: number): Flat {
	const b = new Builder();
	switch (kind) {
		case 'figure':
			figureFlat(db, id, b);
			break;
		case 'drill':
			drillFlat(db, id, b);
			break;
		case 'song':
			songFlat(db, id, b);
			break;
		case 'routine':
			routineFlat(db, id, b);
			break;
		case 'lesson':
			lessonFlat(db, id, b);
			break;
	}
	return b.flat;
}

function missing(kind: string, id: number): never {
	throw new Error(`No ${kind} ${id}`);
}

/* ── Figures ─────────────────────────────────────────────────────────────── */

function figureFlat(db: Db, id: number, b: Builder): void {
	const f = db.select().from(figures).where(eq(figures.id, id)).get() ?? missing('figure', id);
	b.add('name', f.name);
	b.add('notes', f.notes ?? '');
	b.add('partner', f.partner, PARTNER_LABEL[f.partner as Partner] ?? f.partner);
	const style = f.styleTag ?? '';
	b.add('style', style, styleShow(f.dance, style));
	const start = f.startCount ?? DEFAULT_START_COUNT;
	const length = f.lengthCounts ?? DEFAULT_LENGTH_COUNTS;
	b.add('timing', `${start}|${length}`, timingLine(start, length).main);
	positionsField(db, f, b);
	linkFields(db, eq(links.figureId, id), b);

	const recs = db
		.select()
		.from(recordings)
		.where(eq(recordings.figureId, id))
		.orderBy(asc(recordings.id))
		.all();
	for (const r of recs) {
		const piece = `rec:${ref(r.geneId, r.id)}`;
		const day = dayMonth(localDay(r.createdAt, 'UTC'));
		const what = r.kind === 'audio' ? 'Audio' : 'Recording';
		b.add(piece, `${r.mime}|${r.sizeBytes}`, r.note || `${what}, ${day}`, day);
		b.add(`${piece}:note`, r.note ?? '', r.note ?? '', day);
		spotFields(db, piece, eq(videoSpots.recordingId, r.id), b);
	}
}

function styleShow(dance: string, style: string): string {
	if (!style) return '';
	try {
		return getDance(dance).styleLabel[style] ?? style;
	} catch {
		return style;
	}
}

/**
 * Start positions (sorted ids) and the end id, as stored: an untagged figure
 * reads as empty, shown as the dance's neutral position.
 */
function positionsField(
	db: Db,
	f: { id: number; dance: string; endPositionId: number | null },
	b: Builder
): void {
	const starts = db
		.select({ id: figureStartPositions.positionId })
		.from(figureStartPositions)
		.where(eq(figureStartPositions.figureId, f.id))
		.all()
		.map((r) => r.id)
		.sort((x, y) => x - y);
	const all = db.select().from(positions).where(eq(positions.dance, f.dance)).all();
	const name = new Map(all.map((p) => [p.id, p.name]));
	const neutral = all.find((p) => p.neutral)?.name ?? '';
	const startShow = starts.length > 0 ? starts.map((s) => name.get(s) ?? '?').join(', ') : neutral;
	const endShow = f.endPositionId !== null ? (name.get(f.endPositionId) ?? '?') : neutral;
	b.add('positions', `${starts.join(',')}>${f.endPositionId ?? ''}`, `${startShow} → ${endShow}`);
}

/* ── Links, pieces, sections ────────────────────────────────────────────── */

function linkFields(db: Db, owner: SQL, b: Builder): void {
	for (const l of db.select().from(links).where(owner).orderBy(asc(links.id)).all()) {
		b.add(`link:${l.url}`, '1', l.title || l.url);
	}
}

/** A piece's spots (points and sections) and each one's links. */
function spotFields(db: Db, piece: string, owner: SQL, b: Builder): void {
	const spots = db
		.select()
		.from(videoSpots)
		.where(owner)
		.orderBy(asc(videoSpots.startMs), asc(videoSpots.id))
		.all();
	const targets = spotTargets(
		db,
		spots.map((s) => s.id)
	);
	for (const s of spots) {
		const key = `${piece}:spot:${ref(s.geneId, s.id)}`;
		const name = spotLabel(s);
		b.add(key, `${s.startMs}|${s.endMs ?? ''}|${s.label ?? ''}`, name);
		const found = (targets.get(s.id) ?? []).sort((x, y) =>
			x.ref < y.ref ? -1 : x.ref > y.ref ? 1 : 0
		);
		b.add(
			`${key}:links`,
			found.map((t) => t.ref).join(','),
			found.map((t) => t.show).join(', '),
			name
		);
	}
}

type Target = { ref: string; show: string };

/** Each spot's link targets, as `fig:<ref>` / `drill:<ref>` with a name to show. */
function spotTargets(db: Db, spotIds: number[]): Map<number, Target[]> {
	const out = new Map<number, Target[]>();
	if (spotIds.length === 0) return out;
	const push = (spotId: number, t: Target) => {
		const list = out.get(spotId);
		if (list) list.push(t);
		else out.set(spotId, [t]);
	};
	for (const r of db
		.select({
			spotId: spotLinks.spotId,
			id: figures.id,
			gene: figures.geneId,
			name: figures.name,
			move: figureGroups.name
		})
		.from(spotLinks)
		.innerJoin(figures, eq(figures.id, spotLinks.figureId))
		.leftJoin(figureGroups, eq(figureGroups.id, figures.groupId))
		.where(inArray(spotLinks.spotId, spotIds))
		.all())
		push(r.spotId, { ref: `fig:${ref(r.gene, r.id)}`, show: figureShow(r.move, r.name) });
	for (const r of db
		.select({
			spotId: spotLinks.spotId,
			id: exercises.id,
			gene: exercises.geneId,
			name: exercises.name
		})
		.from(spotLinks)
		.innerJoin(exercises, eq(exercises.id, spotLinks.exerciseId))
		.where(inArray(spotLinks.spotId, spotIds))
		.all())
		push(r.spotId, { ref: `drill:${ref(r.gene, r.id)}`, show: r.name });
	return out;
}

const figureShow = (move: string | null, name: string) => (move ? `${move} · ${name}` : name);

/* ── Drills and songs ───────────────────────────────────────────────────── */

function drillFlat(db: Db, id: number, b: Builder): void {
	const d = db.select().from(exercises).where(eq(exercises.id, id)).get() ?? missing('drill', id);
	b.add('name', d.name);
	b.add('notes', d.notes ?? '');
	const practice = JSON.stringify({
		mode: d.practiceMode,
		bpm: d.countBpm,
		config: d.practiceJson
	});
	const show =
		d.practiceMode === 'count'
			? `Count · ${d.countBpm ?? '?'} BPM`
			: d.practiceMode === 'song'
				? 'To a song'
				: 'None';
	b.add('practice', practice, show);
	linkFields(db, eq(links.exerciseId, id), b);
}

function songFlat(db: Db, id: number, b: Builder): void {
	const s = db.select().from(songs).where(eq(songs.id, id)).get() ?? missing('song', id);
	b.add('title', s.title);
	b.add('artist', s.artist ?? '');
	b.add('style', s.style, styleShow(s.dance, s.style));
	let anchors: unknown[] = [];
	try {
		const parsed = JSON.parse(s.anchorsJson);
		if (Array.isArray(parsed)) anchors = parsed;
	} catch {
		// An unreadable count compares as empty.
	}
	const tempo = TEMPO_LABEL[s.tempoFactor as TempoFactor] ?? `×${s.tempoFactor}`;
	b.add(
		'count',
		`${JSON.stringify(anchors)}|${s.tempoFactor}`,
		`${plural(anchors.length, 'tap', 'taps')} · ${tempo}`
	);
	b.add(
		'sample',
		s.sampleStartS === null ? '' : String(s.sampleStartS),
		s.sampleStartS === null ? 'Automatic' : `From ${clock(s.sampleStartS)}`
	);
}

/* ── Routines ───────────────────────────────────────────────────────────── */

/** A slot's options, main figure first: the order they were added in (as `routines.ts`). */
const MAIN_FIRST = [asc(routineStepOptions.createdAt), sql`routine_step_options.rowid`];

function routineFlat(db: Db, id: number, b: Builder): void {
	const r = db.select().from(routines).where(eq(routines.id, id)).get() ?? missing('routine', id);
	b.add('name', r.name);
	b.add('notes', r.notes ?? '');
	const steps = db
		.select({
			id: routineSteps.id,
			note: routineSteps.note,
			childId: routineSteps.childRoutineId,
			childGene: routines.geneId
		})
		.from(routineSteps)
		.leftJoin(routines, eq(routines.id, routineSteps.childRoutineId))
		.where(eq(routineSteps.routineId, id))
		.orderBy(asc(routineSteps.position))
		.all();
	const options = new Map<number, string[]>();
	if (steps.length > 0) {
		for (const o of db
			.select({ stepId: routineStepOptions.stepId, id: figures.id, gene: figures.geneId })
			.from(routineStepOptions)
			.innerJoin(figures, eq(figures.id, routineStepOptions.figureId))
			.where(
				inArray(
					routineStepOptions.stepId,
					steps.map((s) => s.id)
				)
			)
			.orderBy(...MAIN_FIRST)
			.all()) {
			const list = options.get(o.stepId);
			if (list) list.push(ref(o.gene, o.id));
			else options.set(o.stepId, [ref(o.gene, o.id)]);
		}
	}
	const slots = steps.map((s) => ({
		child: s.childId === null ? null : ref(s.childGene, s.childId),
		options: options.get(s.id) ?? [],
		note: s.note || null
	}));
	b.add('slots', JSON.stringify(slots), plural(slots.length, 'slot', 'slots'));
}

/* ── Lessons ────────────────────────────────────────────────────────────── */

function lessonFlat(db: Db, id: number, b: Builder): void {
	const l = db.select().from(lessons).where(eq(lessons.id, id)).get() ?? missing('lesson', id);
	b.add('title', l.title);
	b.add('day', l.lessonDay, dateLabel(l.lessonDay));
	b.add('notes', l.notes ?? '');
	linkFields(db, eq(links.lessonId, id), b);

	for (const f of db
		.select({ id: figures.id, gene: figures.geneId, name: figures.name, move: figureGroups.name })
		.from(lessonFigures)
		.innerJoin(figures, eq(figures.id, lessonFigures.figureId))
		.leftJoin(figureGroups, eq(figureGroups.id, figures.groupId))
		.where(eq(lessonFigures.lessonId, id))
		.all())
		b.add(`fig:${ref(f.gene, f.id)}`, '1', figureShow(f.move, f.name));
	for (const r of db
		.select({ id: routines.id, gene: routines.geneId, name: routines.name })
		.from(lessonRoutines)
		.innerJoin(routines, eq(routines.id, lessonRoutines.routineId))
		.where(eq(lessonRoutines.lessonId, id))
		.all())
		b.add(`routine:${ref(r.gene, r.id)}`, '1', r.name);
	for (const d of db
		.select({ id: exercises.id, gene: exercises.geneId, name: exercises.name })
		.from(lessonExercises)
		.innerJoin(exercises, eq(exercises.id, lessonExercises.exerciseId))
		.where(eq(lessonExercises.lessonId, id))
		.all())
		b.add(`drill:${ref(d.gene, d.id)}`, '1', d.name);

	const videos = db
		.select()
		.from(lessonVideos)
		.where(eq(lessonVideos.lessonId, id))
		.orderBy(asc(lessonVideos.id))
		.all();
	videos.forEach((v, i) => {
		const piece = `video:${ref(v.geneId, v.id)}`;
		b.add(piece, `${v.mime}|${v.sizeBytes}`, `Video ${i + 1}`, String(i + 1));
		spotFields(db, piece, eq(videoSpots.lessonVideoId, v.id), b);
	});
}
