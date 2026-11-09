/**
 * Publish a group's lesson draft: from then on its members see it, and its
 * drills come to their Today. There is no unpublish, so there is no Undo; the
 * page says so before it runs.
 */
import { publishLesson } from '../../lessons';
import { isTeam } from '../../scope';
import { refuse, unknownKey, wholeNumber } from '../../mcp/args';
import { editable } from '../reach';
import { registerKinds, type LineKind } from '.';

const publish: LineKind<{ id: number }> = {
	kind: 'publish_lesson',
	shape: '{ lesson_id }',
	parse(raw) {
		const extra = unknownKey(raw, ['lesson_id'], 'publish_lesson', 'lesson_id');
		if (extra) return refuse(extra);
		const id = wholeNumber(raw.lesson_id, 1, Number.MAX_SAFE_INTEGER);
		return id === null ? refuse('lesson_id must be a whole number.') : { ok: true, args: { id } };
	},
	prepare(db, who, p) {
		const e = editable(db, who.userId, who.dance, 'lesson', p.id);
		if (!e) return { ok: false, message: `No lesson with id ${p.id} that you can edit.` };
		if (!isTeam(e.space))
			return {
				ok: false,
				message: 'Only a group`s lesson is published; this one is the person`s own.'
			};
		if ((e.row as { publishedAt: number | null }).publishedAt !== null)
			return { ok: false, message: 'This lesson is already published.' };
		return { ok: true, before: null };
	},
	run(db, who, p, _before, now) {
		const e = editable(db, who.userId, who.dance, 'lesson', p.id);
		if (!e) return { ok: false, refusal: { code: 'gone' } };
		if (!isTeam(e.space)) return { ok: false, refusal: { code: 'notGroup' } };
		return publishLesson(db, e.space, p.id, now)
			? { ok: true, result: {} }
			: { ok: false, refusal: { code: 'gone' } };
	},
	undo: null,
	flows: (_db, p) => ({ kind: 'lesson', id: p.id })
};

registerKinds(publish as never);
