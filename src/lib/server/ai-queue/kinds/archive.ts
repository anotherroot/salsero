/**
 * Archive and restore a figure, routine, drill, lesson or position: never a
 * delete. Through the same functions the pages and Recently deleted use; each
 * is the other's Undo.
 */
import type { Db } from '../../db';
import type { Space } from '../../scope';
import { archiveVariation, restoreVariation } from '../../figures';
import { archiveRoutine, restoreRoutine } from '../../routines';
import { archiveExercise, restoreDrill } from '../../exercises';
import { archiveLesson, restoreLesson } from '../../lessons';
import { archivePosition, restorePositionIn } from '../../positions';
import type { ArchiveRestore } from '../../trash';
import { refuse, unknownKey, wholeNumber } from '../../mcp/args';
import { editable, type Thing } from '../reach';
import { registerKinds, type LineKind, type Undone, type Who } from '.';

const THINGS = {
	figure: {
		archive: (db: Db, id: number, now: number, by: string) =>
			archiveVariation(db, id, now, by) !== null,
		restore: restoreVariation
	},
	routine: { archive: archiveRoutine, restore: restoreRoutine },
	drill: { archive: archiveExercise, restore: restoreDrill },
	lesson: { archive: archiveLesson, restore: restoreLesson },
	position: {
		archive: (db: Db, id: number, now: number, by: string) =>
			archivePosition(db, id, now, { actorId: by }),
		restore: restorePositionIn
	}
} as const;
type ThingKey = keyof typeof THINGS;
const KEYS = Object.keys(THINGS) as ThingKey[];
type Payload = { thing: ThingKey; id: number };

function parse(kind: string) {
	return (raw: Record<string, unknown>) => {
		const extra = unknownKey(raw, ['thing', 'id'], kind, 'thing and id');
		if (extra) return refuse(extra);
		if (!KEYS.includes(raw.thing as ThingKey))
			return refuse(`thing must be one of: ${KEYS.join(', ')}.`);
		const id = wholeNumber(raw.id, 1, Number.MAX_SAFE_INTEGER);
		if (id === null) return refuse('id must be a whole number. Ids come from search or list.');
		return { ok: true as const, args: { thing: raw.thing as ThingKey, id } };
	};
}

function doArchive(db: Db, who: Who, p: Payload, now: number): Undone {
	if (!editable(db, who.userId, who.dance, p.thing as Thing, p.id))
		return { ok: false, refusal: { code: 'gone' } };
	return THINGS[p.thing].archive(db, p.id, now, who.userId)
		? { ok: true }
		: { ok: false, refusal: { code: 'gone' } };
}

function doRestore(db: Db, who: Who, p: Payload, now: number): Undone {
	const e = editable(db, who.userId, who.dance, p.thing as Thing, p.id, 'archived');
	if (!e) return { ok: false, refusal: { code: 'notArchived' } };
	const r: ArchiveRestore = THINGS[p.thing].restore(db, e.space as Space, p.id, now);
	if (r.ok) return { ok: true };
	return {
		ok: false,
		refusal: r.reason === 'taken' ? { code: 'nameTaken', args: { name: '' } } : { code: 'gone' }
	};
}

const archive: LineKind<Payload> = {
	kind: 'archive',
	shape: `{ thing: ${KEYS.join(' | ')}, id }`,
	parse: parse('archive'),
	prepare: (db, who, p) =>
		editable(db, who.userId, who.dance, p.thing as Thing, p.id)
			? { ok: true, before: null }
			: { ok: false, message: `No ${p.thing} with id ${p.id} that you can archive.` },
	run: (db, who, p, _b, now) => {
		const r = doArchive(db, who, p, now);
		return r.ok ? { ok: true, result: {} } : r;
	},
	undo: (db, who, p, _r, now) => doRestore(db, who, p, now),
	flows: () => null
};

const restore: LineKind<Payload> = {
	kind: 'restore',
	shape: `{ thing: ${KEYS.join(' | ')}, id }`,
	parse: parse('restore'),
	prepare: (db, who, p) =>
		editable(db, who.userId, who.dance, p.thing as Thing, p.id, 'archived')
			? { ok: true, before: null }
			: { ok: false, message: `No archived ${p.thing} with id ${p.id} that you can restore.` },
	run: (db, who, p, _b, now) => {
		const r = doRestore(db, who, p, now);
		return r.ok ? { ok: true, result: {} } : r;
	},
	undo: (db, who, p, _r, now) => doArchive(db, who, p, now),
	flows: () => null
};

registerKinds(archive as never, restore as never);
