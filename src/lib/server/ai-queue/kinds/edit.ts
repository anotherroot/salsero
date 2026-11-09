/**
 * The edit kinds: change a few fields of one row, through the data function
 * the row's own form (or the group History's Restore) uses. At propose the
 * line keeps the values it will overwrite; a run refuses `changed` when any of
 * them is no longer what it was, and Undo refuses when the run's values are no
 * longer there. Nothing is ever written blind.
 */
import type { Db } from '../../db';
import { exercises, figureGroups, figures, videoSpots } from '../../db/schema';
import { figureNameTaken, renameFigure, updateVariation } from '../../figures';
import { updateRoutine } from '../../routines';
import { updateExercise } from '../../exercises';
import { updateLesson } from '../../lessons';
import { updatePosition } from '../../positions';
import { SpotError, updateSpot } from '../../spots';
import { checkSeen } from '../../clash';
import { rootOfSpot } from '../../clones/flow-hook';
import type { Hold } from '$lib/types';
import type { Seen } from '$lib/clash/clash';
import { refuse, unknownKey, wholeNumber, type Parsed } from '../../mcp/args';
import { editable, type Thing } from '../reach';
import { registerKinds, type LineKind, type Refusal, type Who } from '.';

type Value = string | number | null;
type Values = Record<string, Value>;
type FieldType = 'name' | 'text' | 'label' | 'ms';

export const NAME_MAX = 200;
export const TEXT_MAX = 10_000;

/** One field of the AI's payload, checked; `undefined` when absent. */
function field(v: unknown, type: FieldType, key: string): Parsed<Value | undefined> {
	if (v === undefined) return { ok: true, args: undefined };
	switch (type) {
		case 'name':
			return typeof v === 'string' && v.trim() && v.length <= NAME_MAX
				? { ok: true, args: v.trim() }
				: refuse(`${key} must be text of 1 to ${NAME_MAX} characters.`);
		case 'label':
			if (v === null) return { ok: true, args: null };
			return typeof v === 'string' && v.length <= NAME_MAX
				? { ok: true, args: v.trim() || null }
				: refuse(`${key} must be text of at most ${NAME_MAX} characters, or null.`);
		case 'text':
			if (v === null) return { ok: true, args: null };
			return typeof v === 'string' && v.length <= TEXT_MAX
				? { ok: true, args: v === '' ? null : v }
				: refuse(`${key} must be text of at most ${TEXT_MAX} characters, or null.`);
		case 'ms': {
			const n = wholeNumber(v, 0, 24 * 3600_000);
			return n === null
				? refuse(`${key} must be a whole number of milliseconds.`)
				: { ok: true, args: n };
		}
	}
}

export type EditPayload = { id: number; set: Values };

interface EditSpec<R> {
	kind: string;
	thing: Thing;
	idKey: string;
	fields: Record<string, FieldType>;
	/** The row's current values of its editable fields, by payload key. */
	current(row: R): Values;
	/** Write `values` (every editable field, current merged with the change). */
	write(db: Db, who: Who, row: R, values: Values, now: number): Refusal | null;
	/** A refusal before anything is written (at prepare too). */
	check?(db: Db, who: Who, row: R, set: Values): Refusal | null;
	flows?(db: Db, id: number): ReturnType<LineKind['flows']>;
	/** At prepare, the words for `check`'s refusal. */
	explain?: Record<string, string>;
}

const pick = (v: Values, keys: string[]): Seen =>
	Object.fromEntries(keys.map((k) => [k, v[k] ?? null]));

function fieldEdit<R>(spec: EditSpec<R>): LineKind<EditPayload> {
	const keys = Object.keys(spec.fields);
	const missing = (id: number) => `No ${spec.thing} with id ${id} that you can edit.`;
	const rowOf = (db: Db, who: Who, id: number) =>
		editable(db, who.userId, who.dance, spec.thing, id) as { row: R } | null;

	/** Compare what is there now with what the line expects, then write. */
	function apply(
		db: Db,
		who: Who,
		id: number,
		expect: Values,
		set: Values,
		now: number,
		checked: boolean
	) {
		const e = rowOf(db, who, id);
		if (!e) return { ok: false as const, refusal: { code: 'gone' } as Refusal };
		const changedKeys = Object.keys(set);
		const current = spec.current(e.row);
		const seen = checkSeen(pick(current, changedKeys), pick(expect, changedKeys));
		if (!seen.ok)
			return {
				ok: false as const,
				refusal: ('gone' in seen
					? { code: 'gone' }
					: { code: 'changed', args: { fields: seen.changed.join(', ') } }) as Refusal
			};
		const refused =
			(checked ? spec.check?.(db, who, e.row, set) : null) ??
			spec.write(db, who, e.row, { ...current, ...set }, now);
		return refused ? { ok: false as const, refusal: refused } : { ok: true as const };
	}

	return {
		kind: spec.kind,
		shape: `{ ${spec.idKey}, ${keys.map((k) => `${k}?`).join(', ')} }`,
		parse(raw) {
			const extra = unknownKey(
				raw,
				[spec.idKey, ...keys],
				spec.kind,
				`${spec.idKey} and ${keys.join(', ')}`
			);
			if (extra) return refuse(extra);
			const id = wholeNumber(raw[spec.idKey], 1, Number.MAX_SAFE_INTEGER);
			if (id === null)
				return refuse(`${spec.idKey} must be a whole number. Ids come from search or list.`);
			const set: Values = {};
			for (const k of keys) {
				const f = field(raw[k], spec.fields[k], k);
				if (!f.ok) return f;
				if (f.args !== undefined) set[k] = f.args;
			}
			if (!Object.keys(set).length) return refuse(`Say what to change: ${keys.join(', ')}.`);
			return { ok: true, args: { id, set } };
		},
		prepare(db, who, p) {
			const e = rowOf(db, who, p.id);
			if (!e) return { ok: false, message: missing(p.id) };
			const refused = spec.check?.(db, who, e.row, p.set);
			if (refused) return { ok: false, message: spec.explain?.[refused.code] ?? refused.code };
			return { ok: true, before: pick(spec.current(e.row), Object.keys(p.set)) };
		},
		run(db, who, p, before, now) {
			const expect = (before ?? {}) as Values;
			const r = apply(db, who, p.id, expect, p.set, now, true);
			return r.ok ? { ok: true, result: { before: expect, after: p.set } } : r;
		},
		undo(db, who, p, result, now) {
			return apply(db, who, p.id, result.after as Values, result.before as Values, now, false);
		},
		flows: (db, p) => spec.flows?.(db, p.id) ?? null
	};
}

const str = (v: Value) => (v === null ? null : String(v));
const nameOf = (v: Value, fallback: string) => (typeof v === 'string' && v ? v : fallback);

type MoveRow = typeof figureGroups.$inferSelect;
type FigureRow = typeof figures.$inferSelect;
type DrillRow = typeof exercises.$inferSelect;
type SpotRow = typeof videoSpots.$inferSelect;

const renameMove = fieldEdit<MoveRow>({
	kind: 'rename_move',
	thing: 'move',
	idKey: 'move_id',
	fields: { name: 'name' },
	current: (r) => ({ name: r.name }),
	check(db, who, r, set) {
		const space = editable(db, who.userId, who.dance, 'move', r.id)!.space;
		const name = String(set.name);
		return figureNameTaken(db, space, name, r.id) ? { code: 'nameTaken', args: { name } } : null;
	},
	explain: {
		nameTaken: 'Another move already has that name; pick another or rename that one first.'
	},
	write: (db, who, r, v, now) =>
		renameFigure(db, r.id, nameOf(v.name, r.name), who.userId, now)
			? null
			: { code: 'nameTaken', args: { name: String(v.name) } }
});

const editFigure = fieldEdit<FigureRow>({
	kind: 'edit_figure',
	thing: 'figure',
	idKey: 'figure_id',
	fields: { name: 'name', notes: 'text' },
	current: (r) => ({ name: r.name, notes: r.notes }),
	write: (db, who, r, v, now) =>
		updateVariation(
			db,
			r.id,
			{
				name: nameOf(v.name, r.name),
				notes: str(v.notes),
				partner: r.partner,
				style: r.styleTag ?? ''
			},
			who.userId,
			now
		)
			? null
			: { code: 'nameTaken', args: { name: String(v.name) } },
	flows: (_db, id) => ({ kind: 'figure', id })
});

const editRoutine = fieldEdit<{ id: number; name: string; notes: string | null }>({
	kind: 'edit_routine',
	thing: 'routine',
	idKey: 'routine_id',
	fields: { name: 'name', notes: 'text' },
	current: (r) => ({ name: r.name, notes: r.notes }),
	write: (db, who, r, v, now) =>
		updateRoutine(db, r.id, { name: nameOf(v.name, r.name), notes: str(v.notes) }, who.userId, now)
			? null
			: { code: 'gone' },
	flows: (_db, id) => ({ kind: 'routine', id })
});

const editDrill = fieldEdit<DrillRow>({
	kind: 'edit_drill',
	thing: 'drill',
	idKey: 'drill_id',
	fields: { name: 'name', notes: 'text' },
	current: (r) => ({ name: r.name, notes: r.notes }),
	// A drill made from a lesson, a figure or a routine takes its name from it.
	check: (_db, _who, r, set) =>
		'name' in set && r.source !== 'custom' ? { code: 'notCustom' } : null,
	explain: {
		notCustom:
			'This drill takes its name from its lesson, figure or routine; change its notes, or rename that.'
	},
	write: (db, who, r, v, now) =>
		updateExercise(
			db,
			r.id,
			{
				name: nameOf(v.name, r.name),
				notes: str(v.notes),
				everyDays: r.everyDays,
				active: r.active
			},
			who.userId,
			now
		)
			? null
			: { code: 'gone' },
	flows: (_db, id) => ({ kind: 'drill', id })
});

const editLesson = fieldEdit<{
	id: number;
	title: string;
	notes: string | null;
	lessonDay: string;
}>({
	kind: 'edit_lesson',
	thing: 'lesson',
	idKey: 'lesson_id',
	fields: { title: 'name', notes: 'text' },
	current: (r) => ({ title: r.title, notes: r.notes }),
	write: (db, who, r, v, now) =>
		updateLesson(
			db,
			r.id,
			{ lessonDay: r.lessonDay, title: nameOf(v.title, r.title), notes: str(v.notes) },
			who.userId,
			now
		)
			? null
			: { code: 'gone' },
	flows: (_db, id) => ({ kind: 'lesson', id })
});

type PositionLike = {
	id: number;
	name: string;
	notes: string | null;
	styleTag: string | null;
	hands: string | null;
	crossed: boolean | null;
	facing: string | null;
	frame: string | null;
	pictureSpotId: number | null;
};
const editPosition = fieldEdit<PositionLike>({
	kind: 'edit_position',
	thing: 'position',
	idKey: 'position_id',
	fields: { name: 'name', notes: 'text' },
	current: (r) => ({ name: r.name, notes: r.notes }),
	write(db, who, r, v, now) {
		const done = updatePosition(
			db,
			r.id,
			{
				name: nameOf(v.name, r.name),
				styleTag: r.styleTag,
				hold: { hands: r.hands, crossed: r.crossed, facing: r.facing, frame: r.frame } as Hold,
				notes: str(v.notes),
				pictureSpotId: r.pictureSpotId
			},
			{ actorId: who.userId, now }
		);
		if (done === null) return { code: 'gone' };
		return 'field' in done ? { code: 'nameTaken', args: { name: String(v.name) } } : null;
	},
	flows: (_db, id) => ({ kind: 'position', id })
});

const editSection = fieldEdit<SpotRow>({
	kind: 'edit_section',
	thing: 'section',
	idKey: 'section_id',
	fields: { label: 'label', start_ms: 'ms', end_ms: 'ms' },
	current: (r) => ({ label: r.label, start_ms: r.startMs, end_ms: r.endMs }),
	write(db, who, r, v, now) {
		try {
			const changes = { label: v.label, startMs: v.start_ms, endMs: v.end_ms };
			return updateSpot(db, r.id, changes, who.userId, now) ? null : { code: 'gone' };
		} catch (e) {
			if (e instanceof SpotError) return { code: 'badSpan' };
			throw e;
		}
	},
	flows: (db, id) => rootOfSpot(db, id)
});

registerKinds(
	renameMove as never,
	editFigure as never,
	editRoutine as never,
	editDrill as never,
	editLesson as never,
	editPosition as never,
	editSection as never
);
