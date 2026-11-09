/**
 * Make new things: a figure (in a move, or a new move), a drill, a routine
 * with its slots, a position, a lesson. Through the same functions the app's
 * New forms call, in the person's own space or a group they own or edit
 * (`group_id`). Undo archives what was made. A create's `result.id` is what
 * a later action's `{"ref": <this action>}` becomes.
 */
import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from '../../db';
import { figures } from '../../db/schema';
import {
	archiveVariation,
	createFigure,
	createVariationIn,
	figureNameTaken,
	variationNameTaken
} from '../../figures';
import { archiveExercise, createCustomExercise } from '../../exercises';
import { archiveRoutine, createRoutine, createRoutineFromFigures } from '../../routines';
import { archivePosition, createPosition } from '../../positions';
import { archiveLesson, createLesson } from '../../lessons';
import { defaultStyle } from '../../default-styles';
import type { Space } from '../../scope';
import type { Hold } from '$lib/types';
import { refuse, unknownKey, wholeNumber, type Parsed } from '../../mcp/args';
import { editable, teamSpaceFor, type Thing } from '../reach';
import { idOrRef, isRef, resolved, type IdOrRef } from './ids';
import { NAME_MAX, TEXT_MAX } from './edit';
import { registerKinds, type LineKind, type Who } from '.';

const nameArg = (v: unknown, key: string): Parsed<string> =>
	typeof v === 'string' && v.trim() && v.length <= NAME_MAX
		? { ok: true, args: v.trim() }
		: refuse(`${key} must be text of 1 to ${NAME_MAX} characters.`);
const notesArg = (v: unknown): Parsed<string | null> =>
	v === undefined || v === null || v === ''
		? { ok: true, args: null }
		: typeof v === 'string' && v.length <= TEXT_MAX
			? { ok: true, args: v }
			: refuse(`notes must be text of at most ${TEXT_MAX} characters.`);
const groupArg = (v: unknown): Parsed<number | null> => {
	if (v === undefined || v === null) return { ok: true, args: null };
	const id = wholeNumber(v, 1, Number.MAX_SAFE_INTEGER);
	return id === null
		? refuse('group_id must be a whole number. Groups come from list_groups.')
		: { ok: true, args: id };
};

/** Where a create goes: the person's own things, or a group they own or edit. */
function spaceFor(db: Db, who: Who, groupId: number | null): Space | null {
	return groupId === null
		? { userId: who.userId, dance: who.dance }
		: teamSpaceFor(db, who.userId, who.dance, groupId);
}
const noGroup = (groupId: number | null) =>
	`No group with id ${groupId} where you can add things (you must own or edit it).`;

const gone = { ok: false as const, refusal: { code: 'gone' } };
const archivedBy = (ok: boolean) => (ok ? { ok: true as const } : gone);
/** Undo archives what was made: only while the person may still edit it (a demoted editor may not). */
const stillMine = (db: Db, who: Who, thing: Thing, result: Record<string, unknown>) =>
	editable(db, who.userId, who.dance, thing, Number(result.id)) ? null : gone;

type CreateFigure = {
	move: IdOrRef | null;
	moveName: string | null;
	name: string;
	notes: string | null;
	groupId: number | null;
};

/** The partner and style a new figure of this move takes: its live figures', else the person's default. */
function baseOf(db: Db, who: Who, moveId: number | null) {
	const base =
		moveId === null
			? undefined
			: db
					.select({ partner: figures.partner, styleTag: figures.styleTag })
					.from(figures)
					.where(and(eq(figures.groupId, moveId), isNull(figures.archivedAt)))
					.get();
	return {
		partner: base?.partner ?? 'partner',
		style: base?.styleTag ?? defaultStyle(db, who.userId, who.dance)
	};
}

const createFigureKind: LineKind<CreateFigure> = {
	kind: 'create_figure',
	shape: '{ move_id | move_name, name, notes?, group_id? } (move_id may be {"ref": <action id>})',
	parse(raw) {
		const extra = unknownKey(
			raw,
			['move_id', 'move_name', 'name', 'notes', 'group_id'],
			'create_figure',
			'move_id or move_name, name, notes and group_id'
		);
		if (extra) return refuse(extra);
		if ((raw.move_id === undefined) === (raw.move_name === undefined))
			return refuse('Give exactly one of move_id (an existing move) and move_name (a new move).');
		const move = raw.move_id === undefined ? null : idOrRef(raw.move_id, 'move_id');
		if (move && !move.ok) return move;
		const moveName = raw.move_name === undefined ? null : nameArg(raw.move_name, 'move_name');
		if (moveName && !moveName.ok) return moveName;
		const name = nameArg(raw.name, 'name');
		if (!name.ok) return name;
		const notes = notesArg(raw.notes);
		if (!notes.ok) return notes;
		const groupId = groupArg(raw.group_id);
		if (!groupId.ok) return groupId;
		return {
			ok: true,
			args: {
				move: move ? move.args : null,
				moveName: moveName ? moveName.args : null,
				name: name.args,
				notes: notes.args,
				groupId: groupId.args
			}
		};
	},
	prepare(db, who, p) {
		if (p.move !== null) {
			if (isRef(p.move)) return { ok: true, before: null };
			if (!editable(db, who.userId, who.dance, 'move', p.move))
				return { ok: false, message: `No move with id ${p.move} that you can edit.` };
			if (variationNameTaken(db, p.move, p.name, null))
				return { ok: false, message: `That move already has a figure named ${p.name}.` };
			return { ok: true, before: null };
		}
		const space = spaceFor(db, who, p.groupId);
		if (!space) return { ok: false, message: noGroup(p.groupId) };
		if (figureNameTaken(db, space, p.moveName!, null))
			return {
				ok: false,
				message: `A move named ${p.moveName} exists already; add the figure to it with move_id.`
			};
		return { ok: true, before: null };
	},
	run(db, who, p) {
		if (p.move !== null) {
			const moveId = resolved(p.move);
			if (!editable(db, who.userId, who.dance, 'move', moveId)) return gone;
			if (variationNameTaken(db, moveId, p.name, null))
				return { ok: false, refusal: { code: 'nameTaken', args: { name: p.name } } };
			const f = createVariationIn(
				db,
				moveId,
				{ name: p.name, notes: p.notes, ...baseOf(db, who, moveId) },
				who.userId
			);
			return f ? { ok: true, result: { id: f.id, moveId } } : gone;
		}
		const space = spaceFor(db, who, p.groupId);
		if (!space) return gone;
		if (figureNameTaken(db, space, p.moveName!, null))
			return { ok: false, refusal: { code: 'nameTaken', args: { name: p.moveName! } } };
		const made = createFigure(db, space, {
			figureName: p.moveName!,
			name: p.name,
			notes: p.notes,
			...baseOf(db, who, null)
		});
		return made ? { ok: true, result: { id: made.figure.id, moveId: made.group.id } } : gone;
	},
	undo: (db, who, _p, result, now) =>
		stillMine(db, who, 'figure', result) ??
		archivedBy(archiveVariation(db, Number(result.id), now, who.userId) !== null),
	flows: () => null
};

type Simple = { name: string; notes: string | null; groupId: number | null };

/** A create with a name, notes and a group: drills and positions. */
function simple(
	kind: string,
	thing: string,
	make: (db: Db, space: Space, p: Simple, now: number) => number | 'taken' | null,
	archive: (db: Db, id: number, now: number, by: string) => boolean
): LineKind<Simple> {
	return {
		kind,
		shape: '{ name, notes?, group_id? }',
		parse(raw) {
			const extra = unknownKey(
				raw,
				['name', 'notes', 'group_id'],
				kind,
				'name, notes and group_id'
			);
			if (extra) return refuse(extra);
			const name = nameArg(raw.name, 'name');
			if (!name.ok) return name;
			const notes = notesArg(raw.notes);
			if (!notes.ok) return notes;
			const groupId = groupArg(raw.group_id);
			if (!groupId.ok) return groupId;
			return { ok: true, args: { name: name.args, notes: notes.args, groupId: groupId.args } };
		},
		prepare: (db, who, p) =>
			spaceFor(db, who, p.groupId)
				? { ok: true, before: null }
				: { ok: false, message: noGroup(p.groupId) },
		run(db, who, p, _b, now) {
			const space = spaceFor(db, who, p.groupId);
			if (!space) return gone;
			const id = make(db, space, p, now);
			if (id === 'taken')
				return { ok: false, refusal: { code: 'nameTaken', args: { name: p.name } } };
			return id === null ? gone : { ok: true, result: { id } };
		},
		undo: (db, who, _p, result, now) =>
			stillMine(db, who, thing as Thing, result) ??
			archivedBy(archive(db, Number(result.id), now, who.userId)),
		flows: () => null
	};
}

const createDrill = simple(
	'create_drill',
	'drill',
	(db, space, p) => createCustomExercise(db, space, { name: p.name, notes: p.notes }).id,
	(db, id, now, by) => archiveExercise(db, id, now, by)
);

const createPositionKind = simple(
	'create_position',
	'position',
	(db, space, p, now) => {
		const made = createPosition(
			db,
			space,
			{
				name: p.name,
				styleTag: null,
				hold: { hands: null, crossed: null, facing: null, frame: null } as Hold,
				notes: p.notes,
				pictureSpotId: null
			},
			now
		);
		return 'field' in made ? 'taken' : made.id;
	},
	(db, id, now, by) => archivePosition(db, id, now, { actorId: by })
);

type CreateRoutine = Simple & { slots: IdOrRef[] };

const createRoutineKind: LineKind<CreateRoutine> = {
	kind: 'create_routine',
	shape: '{ name, notes?, group_id?, slots?: [figure_id] } (a slot may be {"ref": <action id>})',
	parse(raw) {
		const { slots, ...rest } = raw;
		const base = createDrill.parse(rest);
		if (!base.ok) return base;
		const list = slots === undefined ? [] : slots;
		if (!Array.isArray(list) || list.length > 100)
			return refuse('slots must be a list of at most 100 figure ids.');
		const parsed: IdOrRef[] = [];
		for (const s of list) {
			const one = idOrRef(s, 'a slot');
			if (!one.ok) return one;
			parsed.push(one.args);
		}
		return { ok: true, args: { ...base.args, slots: parsed } };
	},
	prepare: (db, who, p) => createDrill.prepare(db, who, p),
	run(db, who, p) {
		const space = spaceFor(db, who, p.groupId);
		if (!space) return gone;
		const input = { name: p.name, notes: p.notes };
		if (!p.slots.length)
			return { ok: true, result: { id: createRoutine(db, space, input).routine.id } };
		// All or nothing, as the coverage page's Create routine: a slot that is not a live figure of this space refuses it.
		const made = createRoutineFromFigures(db, space, input, p.slots.map(resolved));
		return made
			? { ok: true, result: { id: made.routine.id } }
			: { ok: false, refusal: { code: 'badSlot' } };
	},
	undo: (db, who, _p, result, now) =>
		stillMine(db, who, 'routine', result) ??
		archivedBy(archiveRoutine(db, Number(result.id), now, who.userId)),
	flows: () => null
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
type CreateLesson = { title: string; day: string; notes: string | null; groupId: number | null };

const createLessonKind: LineKind<CreateLesson> = {
	kind: 'create_lesson',
	shape:
		'{ title, day: "YYYY-MM-DD", notes?, group_id? } (a group`s lesson is a draft until published)',
	parse(raw) {
		const extra = unknownKey(
			raw,
			['title', 'day', 'notes', 'group_id'],
			'create_lesson',
			'title, day, notes and group_id'
		);
		if (extra) return refuse(extra);
		const title = nameArg(raw.title, 'title');
		if (!title.ok) return title;
		if (typeof raw.day !== 'string' || !DAY.test(raw.day) || Number.isNaN(Date.parse(raw.day)))
			return refuse('day must be a date, YYYY-MM-DD.');
		const notes = notesArg(raw.notes);
		if (!notes.ok) return notes;
		const groupId = groupArg(raw.group_id);
		if (!groupId.ok) return groupId;
		return {
			ok: true,
			args: { title: title.args, day: raw.day, notes: notes.args, groupId: groupId.args }
		};
	},
	prepare: (db, who, p) =>
		spaceFor(db, who, p.groupId)
			? { ok: true, before: null }
			: { ok: false, message: noGroup(p.groupId) },
	run(db, who, p) {
		const space = spaceFor(db, who, p.groupId);
		if (!space) return gone;
		return {
			ok: true,
			result: {
				id: createLesson(db, space, { lessonDay: p.day, title: p.title, notes: p.notes }).lesson.id
			}
		};
	},
	undo: (db, who, _p, result, now) =>
		stillMine(db, who, 'lesson', result) ??
		archivedBy(archiveLesson(db, Number(result.id), now, who.userId)),
	flows: () => null
};

registerKinds(
	createFigureKind as never,
	createDrill as never,
	createRoutineKind as never,
	createPositionKind as never,
	createLessonKind as never
);
