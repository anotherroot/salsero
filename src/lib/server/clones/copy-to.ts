/**
 * Copy to… (spec points 4, 5 and 9; board C4): a figure, routine, drill, song
 * or lesson copied into another place the person can edit — their own app
 * (when it is not theirs already), or any live group of its dance they own or
 * edit, group to group too — as a member of the same family.
 *
 * Into a group the copy brings its recordings, charged to the group (ruling
 * 5); a lesson or a song lands there as a draft. Into the person's own app it
 * brings none; a reader's copy there is Make it mine itself (`makeMine`), so
 * their routines and practice follow it as Edit's would, while an editor's is
 * just a copy (ruling 1: the group's row stays theirs to edit).
 *
 * Only one version goes (spec point 5): when something that would be copied
 * has twins the person sees, `copyPlan` asks which one, and `use` carries the
 * answer to the engine; a group never gets twins. A place that already holds
 * a member of the family is left as it is (spec point 9): the copy answers it
 * (`made: false`) for the sheet to open Compare, or to offer Restore first
 * when it is archived (`restoreMember`).
 */
import { and, desc, eq, or } from 'drizzle-orm';
import type {
	CloneKind,
	CopyOffer,
	CopyPlanView,
	CopyTarget,
	PlaceRef,
	TwinChoice,
	TwinKind
} from '$lib/types';
import { localDay } from '$lib/day/day';
import type { DanceSlug } from '$lib/dances/dances';
import { ARCHIVED_SONG_COPY, alreadyLine, twinChoiceMeta, whatGoes } from '$lib/clones/view';
import type { Db } from '../db';
import {
	clonePairs,
	exercises,
	figures,
	lessons,
	lessonVideos,
	recordings,
	routines,
	songs,
	teamChanges
} from '../db/schema';
import { actorOf, inSpace, isTeam, type Space, type TeamSpace } from '../scope';
import { listMyTeams } from '../teams';
import { limitOf, usedBytesOf, type Owner } from '../storage';
import { restoreVariation } from '../figures';
import { restoreRoutine } from '../routines';
import { restoreDrill } from '../exercises';
import { restoreLesson } from '../lessons';
import { restoreDeleted } from '../trash';
import { twinsOf } from '../twins';
import {
	cloneInto,
	planClone,
	useKey,
	type CloneOptions,
	type CloneRequest,
	type CloneResult
} from './clone';
import { accessTo, geneOf, memberIn, placeOfRow } from './genes';
import { logRoot } from './apply';
import { makeMine, rowOf } from './edit';
import type { CloneFiles } from './files';

const DENIED = { ok: false, reason: 'denied' } as const;

const TABLES = {
	figure: figures,
	routine: routines,
	drill: exercises,
	song: songs,
	lesson: lessons
} as const;

const TWIN_KINDS = new Set<string>(['figure', 'routine', 'lesson', 'song']);

/** When a root row was made, or 0 for a missing one. */
function createdOf(db: Db, kind: CloneKind, id: number): number {
	const t = TABLES[kind];
	return db.select({ at: t.createdAt }).from(t).where(eq(t.id, id)).get()?.at ?? 0;
}

/** The row a root row was copied from, or null for an original. */
function clonedFromOf(db: Db, kind: CloneKind, id: number): number | null {
	const t = TABLES[kind];
	return db.select({ from: t.clonedFrom }).from(t).where(eq(t.id, id)).get()?.from ?? null;
}

const ownerOf = (s: Space): Owner => (isTeam(s) ? { teamId: s.teamId } : { userId: s.userId });

/** A place as the space its actor writes in. */
function spaceOf(userId: string, dance: string, place: PlaceRef): Space {
	const slug = dance as DanceSlug;
	return place.kind === 'team'
		? { dance: slug, teamId: place.teamId, actorId: userId }
		: { userId, dance: slug };
}

/** The live row Copy to… may copy: of a dance, readable to the person, a song ready to play. */
function copyable(db: Db, userId: string, kind: CloneKind, id: number) {
	const row = rowOf(db, kind, id);
	if (!row || row.archivedAt !== null) return null;
	const access = accessTo(db, userId, kind, id);
	if (access === null) return null;
	if (kind === 'song') {
		const song = db.select().from(songs).where(eq(songs.id, id)).get()!;
		if (song.status !== 'ready' || !song.audioFile) return null;
	}
	return { ...row, access };
}

/**
 * Where the row can be copied to, in order: the person's own app (unless the
 * row is theirs already), then every live group of its dance they own or
 * edit, by name, leaving out the row's own group. Each with the person's role
 * there, what the place uses of its limit, and the family's member already
 * there (archived included), with when it was made. Empty for a row they
 * cannot read, an archived one, or a song not ready.
 */
export function copyTargets(db: Db, userId: string, kind: CloneKind, id: number): CopyTarget[] {
	const row = copyable(db, userId, kind, id);
	if (!row) return [];
	const gene = geneOf(db, kind, id);
	const target = (place: PlaceRef, role: CopyTarget['role']): CopyTarget => {
		const space = spaceOf(userId, row.dance, place);
		const member = gene === null ? null : memberIn(db, kind, gene, space);
		return {
			place,
			role,
			usedBytes: usedBytesOf(db, ownerOf(space)),
			limitBytes: limitOf(db, ownerOf(space)),
			existing: member && { ...member, at: createdOf(db, kind, member.id) }
		};
	};
	const out: CopyTarget[] = [];
	if (row.teamId !== null) out.push(target({ kind: 'mine' }, null));
	for (const t of listMyTeams(db, userId, row.dance as DanceSlug)) {
		if (t.deletedAt !== null || t.id === row.teamId) continue;
		if (t.role !== 'owner' && t.role !== 'editor') continue;
		out.push(target({ kind: 'team', teamId: t.id, name: t.name }, t.role));
	}
	return out;
}

/** The target `into` names, when it is one of the row's (and `into` acts as the person). */
function targetOf(
	db: Db,
	userId: string,
	kind: CloneKind,
	id: number,
	into: Space
): CopyTarget | null {
	if (actorOf(into) !== userId) return null;
	const row = rowOf(db, kind, id);
	if (!row || row.dance !== into.dance) return null;
	return (
		copyTargets(db, userId, kind, id).find((t) =>
			t.place.kind === 'team'
				? isTeam(into) && into.teamId === t.place.teamId
				: !isTeam(into) && into.userId === userId
		) ?? null
	);
}

const requestOf = (
	kind: CloneKind,
	id: number,
	into: Space,
	use?: Record<string, number>
): CloneRequest => ({ kind, id, into, recordings: isTeam(into), use });

/** Who made a group's row, by its History `add` line, or null. */
function addedBy(db: Db, teamId: number, kind: CloneKind, id: number): string | null {
	const r = rowOf(db, kind, id);
	if (!r) return null;
	const groupId =
		kind === 'figure'
			? (db.select({ g: figures.groupId }).from(figures).where(eq(figures.id, id)).get()?.g ?? null)
			: null;
	const root = logRoot(kind, { id, groupId });
	const line = db
		.select({ actorId: teamChanges.actorId })
		.from(teamChanges)
		.where(
			and(
				eq(teamChanges.teamId, teamId),
				eq(teamChanges.verb, 'add'),
				eq(teamChanges.rootKind, root.rootKind),
				eq(teamChanges.rootId, root.rootId),
				root.subjectId == null ? undefined : eq(teamChanges.subjectId, root.subjectId)
			)
		)
		.orderBy(desc(teamChanges.at))
		.get();
	return line?.actorId ?? null;
}

/**
 * When a row last changed, as far as the app records it: made, a History line
 * on it (a group's row), a copy, Take or Send it was in (its pair snapshots),
 * a recording or video added. A person's own edits are not stamped.
 */
function changedAtOf(db: Db, kind: CloneKind, id: number): number {
	let at = createdOf(db, kind, id);
	const bump = (v: number | null | undefined) => {
		if (v !== null && v !== undefined && v > at) at = v;
	};
	const place = placeOfRow(db, kind, id);
	if (place?.kind === 'team') {
		const groupId =
			kind === 'figure'
				? (db.select({ g: figures.groupId }).from(figures).where(eq(figures.id, id)).get()?.g ??
					null)
				: null;
		const root = logRoot(kind, { id, groupId });
		bump(
			db
				.select({ at: teamChanges.at })
				.from(teamChanges)
				.where(
					and(
						eq(teamChanges.teamId, place.teamId),
						eq(teamChanges.rootKind, root.rootKind),
						kind === 'figure' ? eq(teamChanges.subjectId, id) : eq(teamChanges.rootId, root.rootId)
					)
				)
				.orderBy(desc(teamChanges.at))
				.get()?.at
		);
	}
	bump(
		db
			.select({ at: clonePairs.at })
			.from(clonePairs)
			.where(and(eq(clonePairs.kind, kind), or(eq(clonePairs.aId, id), eq(clonePairs.bId, id))))
			.orderBy(desc(clonePairs.at))
			.get()?.at
	);
	if (kind === 'figure')
		bump(
			db
				.select({ at: recordings.createdAt })
				.from(recordings)
				.where(eq(recordings.figureId, id))
				.orderBy(desc(recordings.createdAt))
				.get()?.at
		);
	if (kind === 'lesson')
		bump(
			db
				.select({ at: lessonVideos.createdAt })
				.from(lessonVideos)
				.where(eq(lessonVideos.lessonId, id))
				.orderBy(desc(lessonVideos.createdAt))
				.get()?.at
		);
	return at;
}

/** The row's own notes, for "· notes" in what goes. */
function hasNotes(db: Db, kind: CloneKind, id: number): boolean {
	if (kind === 'song') return false;
	const t = TABLES[kind];
	const notes = db.select({ notes: t.notes }).from(t).where(eq(t.id, id)).get()?.notes;
	return typeof notes === 'string' && notes.trim() !== '';
}

/** The twins questions: one per family in what would go that has twins the person sees. */
function twinQuestions(
	db: Db,
	userId: string,
	rows: { kind: string; from: number }[],
	into: Space,
	tz: string
): CopyPlanView['twins'] {
	if (!isTeam(into)) return [];
	const out: CopyPlanView['twins'] = [];
	const name = (p: PlaceRef) => (p.kind === 'team' ? p.name : '');
	for (const r of rows) {
		if (!TWIN_KINDS.has(r.kind)) continue;
		const kind = r.kind as TwinKind;
		// A twin already in the place is no version to send there.
		const others = twinsOf(db, userId, kind, r.from).filter(
			(id) => !inSpace(ownerCols(db, kind, id), into)
		);
		if (others.length === 0) continue;
		const choices: TwinChoice[] = [];
		for (const id of [r.from, ...others]) {
			const place = placeOfRow(db, kind, id);
			if (!place) continue;
			const changedAt = changedAtOf(db, kind, id);
			choices.push({ id, place, changedAt, meta: twinChoiceMeta(changedAt, tz) });
		}
		if (choices.length < 2) continue;
		choices.sort(
			(a, b) =>
				Number(a.place.kind === 'team') - Number(b.place.kind === 'team') ||
				name(a.place).localeCompare(name(b.place))
		);
		out.push({
			gene: useKey(kind, { id: r.from, geneId: geneOf(db, kind, r.from) }),
			kind,
			label: rowOf(db, kind, r.from)?.title ?? '',
			from: r.from,
			choices
		});
	}
	return out;
}

/** A row's owner columns, for `inSpace`. */
function ownerCols(db: Db, kind: CloneKind, id: number) {
	const t = TABLES[kind];
	return (
		db
			.select({ userId: t.userId, teamId: t.teamId, dance: t.dance })
			.from(t)
			.where(eq(t.id, id))
			.get() ?? { userId: null, teamId: null, dance: '' }
	);
}

/**
 * What copying the row into `into` would do (the sheet's grey cards): what
 * goes, counted, with the files' size and who is charged; what `into` holds
 * already and is reused ("Enchufla · Doble: Salsa Tuesdays has your copy from
 * 3 Oct. It’s reused, not doubled."); and, into a group, a question per
 * family with twins. Reads only; dates in `tz`.
 */
export function copyPlan(
	db: Db,
	userId: string,
	kind: CloneKind,
	id: number,
	into: Space,
	tz = 'UTC'
): CopyPlanView {
	const plan = planClone(db, requestOf(kind, id, into));
	const place: PlaceRef = isTeam(into) ? teamPlace(db, userId, into) : { kind: 'mine' };
	const nested = plan.rows.slice(1);
	const n = (k: string) => nested.filter((r) => r.kind === k).length;
	const goes = whatGoes({
		kind,
		figures: n('figure'),
		routines: n('routine'),
		drills: n('drill'),
		recordings: n('recording'),
		videos: n('video'),
		audio: kind === 'song' && plan.files.some((f) => f.kind === 'audio'),
		bytes: plan.bytes,
		notes: hasNotes(db, kind, id),
		into: place
	});
	const seen = new Set<string>();
	const already: string[] = [];
	for (const r of plan.reused) {
		const key = `${r.kind}:${r.at}`;
		if (seen.has(key)) continue;
		seen.add(key);
		const day = localDay(createdOf(db, r.kind, r.at), tz);
		// "Your copy": a copy (not the group's own original) that the person put there.
		const yours =
			isTeam(into) &&
			clonedFromOf(db, r.kind, r.at) !== null &&
			addedBy(db, into.teamId, r.kind, r.at) === userId;
		already.push(alreadyLine(rowOf(db, r.kind, r.from)?.title ?? '', place, day, yours));
	}
	return {
		goes,
		bytes: plan.bytes,
		already,
		twins: twinQuestions(db, userId, plan.rows, into, tz)
	};
}

/** A group as a place, by the person's listing of it. */
function teamPlace(db: Db, userId: string, into: TeamSpace): PlaceRef {
	const t = listMyTeams(db, userId, into.dance as DanceSlug).find((x) => x.id === into.teamId);
	return { kind: 'team', teamId: into.teamId, name: t?.name ?? '' };
}

/**
 * `use` as `copyPlan` would accept it for this place: every key one of its
 * twins questions, every answer a choice it offers. `{}` into your own app
 * (nothing is asked there, so answers are dropped); null when any answer is
 * not one the plan asked for, so a forged `use` never steers a copy or names
 * a row's place.
 */
export function validUse(
	db: Db,
	actorId: string,
	kind: CloneKind,
	id: number,
	into: Space,
	use: Record<string, number>
): Record<string, number> | null {
	if (!isTeam(into)) return {};
	const entries = Object.entries(use);
	if (entries.length === 0) return {};
	const asked = twinQuestions(
		db,
		actorId,
		planClone(db, requestOf(kind, id, into)).rows,
		into,
		'UTC'
	);
	for (const [gene, chosen] of entries) {
		const q = asked.find((a) => a.gene === gene);
		if (!q || !q.choices.some((c) => c.id === chosen)) return null;
	}
	return use;
}

/**
 * Copy the row into `into` for `actorId` (`cloneInto`, with recordings into a
 * group; a reader's copy into their own app is `makeMine`). The member of the
 * row's own family already in `into` is answered as it is (`made: false`,
 * `archived` when it is), for Compare or Restore, whatever `use` says: an
 * answer left over from another place is ignored there. Otherwise `use`
 * answers `copyPlan`'s twins questions (`validUse`): a choice it did not
 * offer, or a place that is not one of the row's targets, is `denied`; the
 * chosen twin's member there is answered the same way. `room` and `name`
 * refusals as the engine's.
 */
export async function copyTo(
	db: Db,
	actorId: string,
	kind: CloneKind,
	id: number,
	into: Space,
	use: Record<string, number>,
	files: CloneFiles,
	now: number,
	freeDiskBytes: number,
	/** Move to…: what follows a new copy, in its transaction (`cloneInto`'s `after`). */
	opts: Pick<CloneOptions, 'after'> = {}
): Promise<CloneResult> {
	if (!targetOf(db, actorId, kind, id, into)) return DENIED;
	const own = planClone(db, requestOf(kind, id, into));
	if (own.sourceId === null) return DENIED;
	if (own.existing) return { ok: true, made: false, ...own.existing };
	const answers = validUse(db, actorId, kind, id, into, use);
	if (answers === null) return DENIED;
	const req = requestOf(kind, id, into, isTeam(into) ? answers : undefined);
	const plan = planClone(db, req);
	if (plan.sourceId === null) return DENIED;
	if (plan.existing) return { ok: true, made: false, ...plan.existing };
	if (!isTeam(into) && accessTo(db, actorId, kind, id) === 'read') {
		const res = await makeMine(db, into, kind, id, files, now, freeDiskBytes);
		// An archived song copy is a member there, answered above; only a race gets here.
		return !res.ok && res.reason === 'archived' ? DENIED : (res as CloneResult);
	}
	return cloneInto(db, req, files, now, freeDiskBytes, opts);
}

/**
 * The row a copy with these choices would copy: the page's own, or the twin
 * `use` chose. A `use` that `validUse` refuses counts as none, so it never
 * names a row the plan did not offer.
 */
export function chosenSource(
	db: Db,
	actorId: string,
	kind: CloneKind,
	id: number,
	into: Space,
	use: Record<string, number>
): number {
	const answers = validUse(db, actorId, kind, id, into, use) ?? {};
	return (
		planClone(db, requestOf(kind, id, into, isTeam(into) ? answers : undefined)).sourceId ?? id
	);
}

/**
 * Restore the family's archived member in `into` (Copy to… offers it before
 * Compare): the row's own family's, or the archived member of the twin `use`
 * chose (`validUse`), so a copy answered `archived` for a twin can be
 * restored. Recently deleted's restore in a group, the kind's own restore in
 * the person's app (a person's song has none). Null when `memberId` is
 * neither.
 */
export function restoreMember(
	db: Db,
	actorId: string,
	kind: CloneKind,
	id: number,
	into: Space,
	memberId: number,
	now: number,
	use: Record<string, number> = {}
): { ok: true } | { ok: false; message: string } | null {
	const target = targetOf(db, actorId, kind, id, into);
	if (!target) return null;
	const archivedHere = (m: { id: number; archived: boolean } | null) =>
		m !== null && m.archived && m.id === memberId;
	if (!archivedHere(target.existing)) {
		const answers = validUse(db, actorId, kind, id, into, use);
		if (!answers || Object.keys(answers).length === 0) return null;
		if (!archivedHere(planClone(db, requestOf(kind, id, into, answers)).existing)) return null;
	}
	if (isTeam(into))
		return restoreDeleted(db, into, kind === 'figure' ? 'variation' : kind, memberId, now);
	if (kind === 'song') return { ok: false, message: ARCHIVED_SONG_COPY };
	const restore = {
		figure: restoreVariation,
		routine: restoreRoutine,
		drill: restoreDrill,
		lesson: restoreLesson
	}[kind];
	const done = restore(db, into, memberId, now);
	if (done.ok) return done;
	return done.reason === 'gone' ? null : { ok: false, message: done.message };
}

/** What the page's Copy to… offers: the row's title and its targets; null when it has none. */
export function copyOffer(db: Db, userId: string, kind: CloneKind, id: number): CopyOffer | null {
	const targets = copyTargets(db, userId, kind, id);
	const row = rowOf(db, kind, id);
	if (targets.length === 0 || !row) return null;
	return { kind, title: row.title, fromMine: row.teamId === null, targets };
}

/**
 * The place a form or a query names (`mine`, or a group's id) as the space
 * the person writes in, when it is one of the row's targets; else null.
 */
export function intoOf(
	db: Db,
	userId: string,
	kind: CloneKind,
	id: number,
	raw: string | null
): Space | null {
	const row = rowOf(db, kind, id);
	if (!row || raw === null) return null;
	const place: PlaceRef | null =
		raw === 'mine'
			? { kind: 'mine' }
			: /^\d+$/.test(raw)
				? { kind: 'team', teamId: Number(raw), name: '' }
				: null;
	if (!place) return null;
	const space = spaceOf(userId, row.dance, place);
	return targetOf(db, userId, kind, id, space) ? space : null;
}
