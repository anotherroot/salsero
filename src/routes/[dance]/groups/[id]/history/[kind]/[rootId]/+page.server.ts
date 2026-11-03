import { error, fail } from '@sveltejs/kit';
import { getDb, type Db } from '$lib/server/db';
import { requireTeam } from '$lib/server/scope';
import { history, restoreChange, rootInTeam, teamNames } from '$lib/server/changes';
import { getLessonRow } from '$lib/server/lessons';
import { getGroup, listGroupVariations } from '$lib/server/figures';
import { getRoutine } from '$lib/server/routines';
import { getExercise } from '$lib/server/exercises';
import { int } from '$lib/server/form';
import { canRestore, historyLine, previousValue } from '$lib/teams/history';
import { clashTitle } from '$lib/clash/clash';
import type { ChangeRootKind } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

const KINDS = ['lesson', 'figure', 'routine', 'drill'] as const;
type Kind = (typeof KINDS)[number];

/**
 * The group (for its editors and owner only: History is theirs, a member gets
 * the stranger's 404), and one of its things by kind and id. A thing of
 * another group, or no such thing, is the same 404.
 */
function rootOf(
	params: { dance: string; id: string; kind: string; rootId: string },
	locals: App.Locals
) {
	const db = getDb();
	const { team, space } = requireTeam(db, locals, params, 'editor');
	const kind = KINDS.find((k) => k === params.kind);
	const rootId = Number(params.rootId);
	if (!kind || !Number.isSafeInteger(rootId) || !rootInTeam(db, team.id, kind, rootId)) {
		throw error(404, 'No such history');
	}
	return { db, team, space, kind, rootId };
}

/** What the band names, and where Back goes: the thing's own page. */
function thing(db: Db, dance: string, kind: Kind, id: number): { title: string; href: string } {
	switch (kind) {
		case 'lesson':
			return { title: getLessonRow(db, id)?.title ?? 'Lesson', href: `/${dance}/lessons/${id}` };
		case 'figure': {
			const first = listGroupVariations(db, id)[0];
			return {
				title: getGroup(db, id)?.name ?? 'Figure',
				href: first ? `/${dance}/figures/${first.id}` : `/${dance}/figures`
			};
		}
		case 'routine':
			return { title: getRoutine(db, id)?.name ?? 'Routine', href: `/${dance}/routines/${id}` };
		case 'drill':
			return { title: getExercise(db, id)?.name ?? 'Drill', href: `/${dance}/exercises/${id}` };
	}
}

export const load: PageServerLoad = ({ params, locals }) => {
	const { db, team, kind, rootId } = rootOf(params, locals);
	const rows = history(db, team.id, kind as ChangeRootKind, rootId);
	const names = teamNames(
		db,
		team.id,
		rows.map((r) => r.actorId)
	);
	return {
		team: { id: team.id, name: team.name },
		root: { kind, id: rootId, ...thing(db, team.dance, kind, rootId) },
		changes: rows.map((r) => ({
			id: r.id,
			line: historyLine(r, names),
			at: r.at,
			was: previousValue(r),
			restorable: canRestore(r),
			trashId: r.trashId,
			// A removal kept in the trash, or an archive: Restore is on Recently deleted.
			inDeleted: r.trashId !== null || r.verb === 'archive'
		})),
		now: Date.now()
	};
};

export const actions: Actions = {
	/**
	 * Put a change to text or times back. Refused with who changed it since,
	 * as any save that saw an older version is (the clash check).
	 */
	restore: async ({ params, locals, request }) => {
		const { db, space, kind, rootId } = rootOf(params, locals);
		const changeId = int(await request.formData(), 'changeId');
		const row =
			changeId === undefined
				? null
				: history(db, space.teamId, kind, rootId).find((r) => r.id === changeId);
		if (!row) throw error(404, 'No such change');
		const now = Date.now();
		const done = restoreChange(db, space, row.id, now);
		if (done.ok) return { action: 'restore', ok: true, changeId: row.id };
		switch (done.reason) {
			case 'clash':
				return fail(409, {
					action: 'restore',
					changeId: row.id,
					message: `${clashTitle(done, now)}. Restore would undo that too, so it was not done.`
				});
			case 'gone':
				return fail(410, {
					action: 'restore',
					changeId: row.id,
					message: 'That is no longer there to restore.'
				});
			case 'taken':
				return fail(400, {
					action: 'restore',
					changeId: row.id,
					message: 'That name is taken now. Rename the other one first.'
				});
			default:
				throw error(404, 'No such change');
		}
	}
};
