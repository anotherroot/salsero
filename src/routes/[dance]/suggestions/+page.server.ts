import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { wallOf } from '$lib/server/scope';
import { serverNow } from '$lib/server/server-clock';
import { t } from '$lib/i18n/catalog';
import { queueOf } from '$lib/server/ai-queue/store';
import {
	actionsOfGroup,
	actionsUpTo,
	allPending,
	dropActions,
	runActions,
	toggleLine,
	undoLines,
	type RunReport
} from '$lib/server/ai-queue/run';
import { refusalText, suggestionsView } from '$lib/server/ai-queue/view';
import type { Who } from '$lib/server/ai-queue/kinds';
import type { Actions, PageServerLoad } from './$types';

/**
 * The Suggestions page: the AI's queue, run or dropped by the person
 * (docs/superpowers/plans/2026-11-09-ai-connector-2-queue.md). The account's
 * dance only (`wallOf`); another person's ids answer as missing ones.
 */

export const load: PageServerLoad = async ({ params, locals }) => {
	const wall = wallOf(params, locals);
	return { view: suggestionsView(getDb(), wall.userId, wall.dance, serverNow()) };
};

const whoOf = (params: { dance: string }, locals: App.Locals): Who => {
	const wall = wallOf(params, locals);
	return { userId: wall.userId, dance: wall.dance, grantId: null };
};

function json<T>(raw: FormDataEntryValue | null, fallback: T): T {
	if (typeof raw !== 'string') return fallback;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}
const intOf = (raw: FormDataEntryValue | null) => {
	const n = typeof raw === 'string' ? Number(raw) : NaN;
	return Number.isSafeInteger(n) && n > 0 ? n : null;
};

/** The person's own action and line ids in the queue now; anything else is a 404. */
function own(who: Who, now: number) {
	const groups = queueOf(getDb(), who.userId, who.dance, now);
	const actions = groups.flatMap((g) => g.actions);
	return {
		groups: new Set(groups.map((g) => g.id)),
		actions: new Set(actions.map((a) => a.id)),
		lines: new Set(actions.flatMap((a) => a.lines.map((l) => l.id)))
	};
}
const missing = () => error(404, t().refusals.notFound);

/** What a run answers: the lines it did (for Undo) and how many it refused. */
const answer = (r: RunReport) => ({ done: r.done, refused: r.refused.length });

async function runThese(who: Who, ids: number[], form: FormData, now: number) {
	const versions = json<Record<number, number>>(form.get('versions'), {});
	return answer(await runActions(getDb(), who, ids, versions, now));
}

export const actions: Actions = {
	run: async ({ params, locals, request }) => {
		const who = whoOf(params, locals);
		const now = serverNow();
		const form = await request.formData();
		const ids = json<unknown[]>(form.get('ids'), []).filter((x): x is number =>
			Number.isSafeInteger(x)
		);
		const mine = own(who, now);
		if (!ids.length || ids.some((id) => !mine.actions.has(id))) missing();
		return runThese(who, ids, form, now);
	},
	runUpTo: async ({ params, locals, request }) => {
		const who = whoOf(params, locals);
		const now = serverNow();
		const form = await request.formData();
		const id = intOf(form.get('id'));
		if (id === null || !own(who, now).actions.has(id)) missing();
		return runThese(who, actionsUpTo(getDb(), who, id!, now), form, now);
	},
	runGroup: async ({ params, locals, request }) => {
		const who = whoOf(params, locals);
		const now = serverNow();
		const form = await request.formData();
		const id = intOf(form.get('id'));
		if (id === null || !own(who, now).groups.has(id)) missing();
		return runThese(who, actionsOfGroup(getDb(), who, id!, now), form, now);
	},
	runAll: async ({ params, locals, request }) => {
		const who = whoOf(params, locals);
		const now = serverNow();
		return runThese(who, allPending(getDb(), who, now), await request.formData(), now);
	},
	drop: async ({ params, locals, request }) => {
		const who = whoOf(params, locals);
		const now = serverNow();
		const form = await request.formData();
		const id = intOf(form.get('id'));
		if (id === null || !own(who, now).actions.has(id)) missing();
		const r = dropActions(getDb(), who, [id!], form.get('withDependents') === '1', now);
		// The page asks before dropping what needs it: the numbers it shows.
		if (r.dependents.length) {
			const n = new Map(
				queueOf(getDb(), who.userId, who.dance, now)
					.flatMap((g) => g.actions)
					.map((a) => [a.id, a.n])
			);
			return { dropped: 0, dependents: r.dependents.map((d) => n.get(d) ?? 0) };
		}
		return { dropped: r.dropped.length, dependents: [] };
	},
	dropAll: async ({ params, locals }) => {
		const who = whoOf(params, locals);
		const now = serverNow();
		const r = dropActions(getDb(), who, allPending(getDb(), who, now), true, now);
		return { dropped: r.dropped.length, dependents: [] };
	},
	toggleLine: async ({ params, locals, request }) => {
		const who = whoOf(params, locals);
		const now = serverNow();
		const id = intOf((await request.formData()).get('lineId'));
		if (id === null || !own(who, now).lines.has(id)) missing();
		if (!toggleLine(getDb(), who, id!, now).ok) missing();
		return { ok: true };
	},
	undo: async ({ params, locals, request }) => {
		const who = whoOf(params, locals);
		const now = serverNow();
		const ids = json<unknown[]>((await request.formData()).get('lineIds'), []).filter(
			(x): x is number => Number.isSafeInteger(x)
		);
		const mine = own(who, now);
		if (!ids.length || ids.some((id) => !mine.lines.has(id))) missing();
		const r = await undoLines(getDb(), who, ids, now);
		// An Undo refused says why (it is not kept on the line: the line stays done).
		return { ...answer(r), reasons: r.refused.map((x) => refusalText(x.refusal)) };
	}
};
