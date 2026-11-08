/**
 * What the player's About shows (one-player design, 2026-11-08): read-only
 * details for an exercise, and for a routine's figures. Every row is read
 * through `access.ts`: a group's figure or drill reaches a member only through
 * a published lesson, and then only what that reach holds (its sections,
 * its recordings), never a draft's.
 */
import { asc, eq, inArray } from 'drizzle-orm';
import type { Db } from './db';
import { exercises, figureGroups, figures, positions, recordings } from './db/schema';
import { drillAccess, figureAccess, reach, type Reach } from './access';
import { figurePositions } from './graph';
import { listLinks, type LinkOwner } from './links';
import { sectionsFor, type Visible } from './spot-links';
import type { Wall } from './scope';
import { DEFAULT_LENGTH_COUNTS, DEFAULT_START_COUNT, nextCount } from '$lib/graph/timing';
import { handsLine } from '$lib/routines/page';
import { hasDetails } from '$lib/player/view';
import { clock } from '$lib/format';
import { t } from '$lib/i18n/catalog';
import type { RunClip, RunDetails } from '$lib/types';

type ExerciseRow = typeof exercises.$inferSelect;

const trimmed = (s: string | null): string | null => {
	const v = s?.trim() ?? '';
	return v === '' ? null : v;
};

/** What a reader of `teamId` sees; computed once per group. */
function readerReach(db: Db, userId: string) {
	const cache = new Map<number, Reach>();
	return (teamId: number): Visible => {
		let r = cache.get(teamId);
		if (!r) {
			r = reach(db, userId, teamId);
			cache.set(teamId, r);
		}
		return r;
	};
}

function sectionClips(
	db: Db,
	userId: string,
	owner: { figureId: number } | { exerciseId: number },
	visible?: Visible
): RunClip[] {
	return sectionsFor(db, owner, visible, userId).map((s) => {
		const range = `${clock(s.spot.startMs / 1000)}–${clock((s.spot.endMs ?? s.spot.startMs) / 1000)}`;
		const from = s.video.from.kind === 'lesson' ? s.video.from.title : t().player.recording;
		return {
			kind: 'section',
			src: s.video.src,
			startMs: s.spot.startMs,
			endMs: s.spot.endMs,
			caption: `${from} · ${range}`
		};
	});
}

const linksOf = (db: Db, owner: LinkOwner) =>
	listLinks(db, owner).map((l) => ({ url: l.url, title: l.title }));

/**
 * Details for each figure (version) id the viewer may read; ids they may not
 * are left out. Each entry is whole: whether it is worth an About is
 * `hasDetails`'s call.
 */
export function figureDetails(
	db: Db,
	userId: string,
	ids: readonly number[]
): Record<number, RunDetails> {
	if (ids.length === 0) return {};
	const rows = db
		.select({ figure: figures, move: figureGroups.name })
		.from(figures)
		.leftJoin(figureGroups, eq(figureGroups.id, figures.groupId))
		.where(inArray(figures.id, [...new Set(ids)]))
		.all();
	const visibleIn = readerReach(db, userId);
	const out: Record<number, RunDetails> = {};
	for (const { figure: f, move } of rows) {
		if (f.archivedAt !== null) continue;
		const access = figureAccess(db, userId, f);
		if (access === null) continue;
		const visible = access === 'read' && f.teamId !== null ? visibleIn(f.teamId) : undefined;

		const start = f.startCount ?? DEFAULT_START_COUNT;
		const length = f.lengthCounts ?? DEFAULT_LENGTH_COUNTS;
		const { startIds, endIds } = figurePositions(db, f.id);
		const posIds = [...startIds, ...endIds];
		const names = new Map(
			posIds.length === 0
				? []
				: db
						.select({ id: positions.id, name: positions.name })
						.from(positions)
						.where(inArray(positions.id, posIds))
						.all()
						.map((p) => [p.id, p.name] as const)
		);
		const hands = handsLine(startIds, endIds, (id) => names.get(id) ?? '');

		const own = db
			.select()
			.from(recordings)
			.where(eq(recordings.figureId, f.id))
			.orderBy(asc(recordings.createdAt), asc(recordings.id))
			.all()
			.filter((r) => r.kind === 'video' && (!visible || visible.recordings.has(r.id)))
			.map((r): RunClip => ({
				kind: 'recording',
				src: `/recordings/${r.file}`,
				startMs: 0,
				endMs: null,
				caption: t().player.recording
			}));

		out[f.id] = {
			heading: move ? `${move} · ${f.name}` : f.name,
			facts: [t().player.timing(start, nextCount(start, length), length), hands].filter(
				(x) => x !== ''
			),
			hasPositions: hands !== '',
			notes: trimmed(f.notes),
			clips: [...sectionClips(db, userId, { figureId: f.id }, visible), ...own],
			links: linksOf(db, { figureId: f.id })
		};
	}
	return out;
}

/**
 * Details for the exercise a run is for: a figure exercise's figure (under the
 * exercise's name), a drill's description, sections and links (an entry reads
 * its group's drill). A routine's details are its figures'; a lesson review has
 * none. Null when there is nothing worth an About.
 */
export function exerciseDetails(db: Db, wall: Wall, exercise: ExerciseRow): RunDetails | null {
	let d: RunDetails | null = null;
	if (exercise.figureId !== null && exercise.source === 'figure') {
		const f = figureDetails(db, wall.userId, [exercise.figureId])[exercise.figureId];
		d = f ? { ...f, heading: exercise.name } : null;
	} else if (exercise.source === 'custom') {
		d = drill(db, wall.userId, exercise, undefined);
	} else if (exercise.source === 'added' && exercise.drillId !== null) {
		const group = db.select().from(exercises).where(eq(exercises.id, exercise.drillId)).get();
		const access = group ? drillAccess(db, wall.userId, group) : null;
		if (group && access !== null && group.archivedAt === null) {
			const visible =
				access === 'read' && group.teamId !== null
					? reach(db, wall.userId, group.teamId)
					: undefined;
			d = { ...drill(db, wall.userId, group, visible), heading: exercise.name };
		}
	}
	return hasDetails(d) ? d : null;
}

function drill(db: Db, userId: string, row: ExerciseRow, visible: Visible | undefined): RunDetails {
	return {
		heading: row.name,
		facts: [],
		hasPositions: false,
		notes: trimmed(row.notes),
		clips: sectionClips(db, userId, { exerciseId: row.id }, visible),
		links: linksOf(db, { exerciseId: row.id })
	};
}
