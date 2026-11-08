import { error, json } from '@sveltejs/kit';
import { t } from '$lib/i18n/catalog';
import { getDb } from '$lib/server/db';
import { listComments, postComment } from '$lib/server/comments';
import type { RequestHandler } from './$types';

/**
 * A group lesson's comments. Flat, like /api/video-spots: the person is the
 * wall, and a stranger, a draft a member cannot read, a person's own lesson
 * and a missing id are the same 404.
 */
function lessonId(params: { id: string }): number {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) throw error(404, t().comments.refused.noLesson);
	return id;
}

export const GET: RequestHandler = ({ params, locals }) => {
	if (!locals.user) throw error(401, t().comments.refused.signIn);
	const list = listComments(getDb(), locals.user.id, lessonId(params));
	if (!list) throw error(404, t().comments.refused.noLesson);
	return json(list);
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) throw error(401, t().comments.refused.signIn);
	const id = lessonId(params);
	const b = (await request.json().catch(() => null)) as {
		body?: unknown;
		replyTo?: unknown;
	} | null;
	if (!b || typeof b !== 'object' || typeof b.body !== 'string')
		throw error(400, t().comments.refused.badJson);
	const replyTo = b.replyTo === undefined || b.replyTo === null ? null : b.replyTo;
	if (replyTo !== null && (typeof replyTo !== 'number' || !Number.isInteger(replyTo))) {
		throw error(400, t().comments.refused.badJson);
	}
	const made = postComment(getDb(), locals.user.id, id, b.body, replyTo, Date.now());
	if ('refused' in made) {
		if (made.refused === 'missing') throw error(404, t().comments.refused.noLesson);
		const status = made.refused === 'closed' ? 403 : 400;
		return json({ message: made.message }, { status });
	}
	return json(made, { status: 201 });
};
