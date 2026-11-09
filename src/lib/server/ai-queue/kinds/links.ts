/**
 * Link a lesson to a figure, a routine, a drill or a position, through the
 * lesson page's own functions (`linkRoutine` and `linkExercise` add the new
 * drill to followers' Today, as there). Undo unlinks, never the sections.
 */
import type { Db } from '../../db';
import {
	linkExercise,
	linkFigure,
	linkPosition,
	linkRoutine,
	unlinkExercise,
	unlinkFigure,
	unlinkPosition,
	unlinkRoutine
} from '../../lessons';
import { refuse, unknownKey } from '../../mcp/args';
import { editable } from '../reach';
import { viewOf } from '../../mcp/view';
import { idOrRef, isRef, resolved, type IdOrRef } from './ids';
import { registerKinds, type LineKind } from '.';

const TARGETS = {
	figure_id: {
		table: 'figures',
		link: linkFigure,
		unlink: (db: Db, l: number, t: number, now: number, by: string) =>
			unlinkFigure(db, l, t, false, now, by)
	},
	routine_id: {
		table: 'routines',
		link: linkRoutine,
		unlink: (db: Db, l: number, t: number, now: number, by: string) =>
			unlinkRoutine(db, l, t, now, by)
	},
	drill_id: {
		table: 'exercises',
		link: linkExercise,
		unlink: (db: Db, l: number, t: number, now: number, by: string) =>
			unlinkExercise(db, l, t, false, now, by)
	},
	position_id: {
		table: 'positions',
		link: linkPosition,
		unlink: (db: Db, l: number, t: number, now: number, by: string) =>
			unlinkPosition(db, l, t, false, now, by)
	}
} as const;
type TargetKey = keyof typeof TARGETS;
const KEYS = Object.keys(TARGETS) as TargetKey[];

type LinkLesson = { lesson: IdOrRef; key: TargetKey; target: IdOrRef };

const linkLesson: LineKind<LinkLesson> = {
	kind: 'link_lesson',
	shape:
		'{ lesson_id, figure_id | routine_id | drill_id | position_id } (each may be {"ref": <action id>})',
	parse(raw) {
		const extra = unknownKey(
			raw,
			['lesson_id', ...KEYS],
			'link_lesson',
			`lesson_id and one of ${KEYS.join(', ')}`
		);
		if (extra) return refuse(extra);
		const lesson = idOrRef(raw.lesson_id, 'lesson_id');
		if (!lesson.ok) return lesson;
		const given = KEYS.filter((k) => raw[k] !== undefined);
		if (given.length !== 1) return refuse(`Give exactly one of ${KEYS.join(', ')}.`);
		const target = idOrRef(raw[given[0]], given[0]);
		if (!target.ok) return target;
		return { ok: true, args: { lesson: lesson.args, key: given[0], target: target.args } };
	},
	prepare(db, who, p) {
		if (!isRef(p.lesson) && !editable(db, who.userId, who.dance, 'lesson', p.lesson))
			return { ok: false, message: `No lesson with id ${p.lesson} that you can edit.` };
		if (!isRef(p.target) && !viewOf(db, who.userId).byId(TARGETS[p.key].table, p.target))
			return {
				ok: false,
				message: `No ${p.key.replace('_id', '')} with id ${p.target}. Ids come from search or list.`
			};
		return { ok: true, before: null };
	},
	run(db, who, p) {
		const lessonId = resolved(p.lesson);
		const targetId = resolved(p.target);
		if (!editable(db, who.userId, who.dance, 'lesson', lessonId))
			return { ok: false, refusal: { code: 'gone' } };
		return TARGETS[p.key].link(db, lessonId, targetId, who.userId)
			? { ok: true, result: { lessonId, targetId } }
			: { ok: false, refusal: { code: 'cannotLink' } };
	},
	undo(db, who, p, result, now) {
		if (!editable(db, who.userId, who.dance, 'lesson', Number(result.lessonId)))
			return { ok: false, refusal: { code: 'gone' } };
		return TARGETS[p.key].unlink(
			db,
			Number(result.lessonId),
			Number(result.targetId),
			now,
			who.userId
		)
			? { ok: true }
			: { ok: false, refusal: { code: 'gone' } };
	},
	flows: (_db, p) => ({ kind: 'lesson', id: resolved(p.lesson) })
};

registerKinds(linkLesson as never);
