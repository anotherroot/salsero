import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { inviteQr } from '$lib/server/invites';
import { createLesson, listTeamLessons } from '$lib/server/lessons';
import { readNewLesson } from '$lib/server/lesson-form';
import { localDay } from '$lib/day/day';
import { requireTeam } from '$lib/server/scope';
import {
	deleteTeam,
	leaveTeam,
	peopleOf,
	remakeCode,
	renameTeam,
	restoreTeam
} from '$lib/server/teams';
import { codeLink, NAME_REFUSAL } from '$lib/teams/view';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, locals, url }) => {
	const db = getDb();
	const { team, role, space } = requireTeam(db, locals, params, 'member');
	const deleted = team.deletedAt !== null;
	// The code is for those who may hand it out; a deleted group shows nothing but Restore.
	const link = !deleted && role !== 'member' ? codeLink(url.origin, team.code) : null;
	return {
		team: { id: team.id, name: team.name, deletedAt: team.deletedAt },
		role,
		people: peopleOf(db, team.id).length,
		code: link ? { link, qr: inviteQr(link) } : null,
		// An editor's list starts with the drafts; a member's holds the published ones only.
		lessons: deleted ? [] : listTeamLessons(db, space.actorId, team.id, role),
		canEdit: !deleted && role !== 'member',
		today: localDay(Date.now(), locals.user!.timezone)
	};
};

export const actions: Actions = {
	/** + New lesson: a draft of the group's, opened at once. Only its editors make one. */
	createLesson: async ({ params, locals, request }) => {
		const db = getDb();
		const { team, space } = requireTeam(db, locals, params, 'editor');
		if (team.deletedAt !== null) throw error(404, 'No such group');
		const read = readNewLesson(
			await request.formData(),
			localDay(Date.now(), locals.user!.timezone),
			false
		);
		if ('refused' in read) return read.refused;
		const { lesson } = createLesson(db, space, read.input);
		throw redirect(303, `/${team.dance}/lessons/${lesson.id}`);
	},

	rename: async ({ params, locals, request }) => {
		const db = getDb();
		const { team } = requireTeam(db, locals, params, 'owner');
		if (team.deletedAt !== null) throw error(404, 'No such group');
		const name = String((await request.formData()).get('name') ?? '');
		if (!renameTeam(db, team.id, name)) {
			return fail(400, { action: 'rename', message: NAME_REFUSAL, name });
		}
		return { ok: true };
	},

	/** A new code; the old link stops working at once. */
	remakeCode: ({ params, locals }) => {
		const db = getDb();
		const { team } = requireTeam(db, locals, params, 'owner');
		if (team.deletedAt !== null) throw error(404, 'No such group');
		remakeCode(db, team.id);
		return { ok: true };
	},

	leave: ({ params, locals }) => {
		const db = getDb();
		const { team, space } = requireTeam(db, locals, params, 'member');
		if (team.deletedAt !== null) throw error(404, 'No such group');
		if (leaveTeam(db, team.id, space.actorId) === 'owner') {
			return fail(400, { action: 'leave', message: 'Hand the group over before you leave it.' });
		}
		throw redirect(303, `/${team.dance}/groups`);
	},

	delete: ({ params, locals }) => {
		const db = getDb();
		const { team, space } = requireTeam(db, locals, params, 'owner');
		if (!deleteTeam(db, team.id, space.actorId, Date.now())) throw error(404, 'No such group');
		throw redirect(303, `/${team.dance}/groups`);
	},

	restore: ({ params, locals }) => {
		const db = getDb();
		const { team, space } = requireTeam(db, locals, params, 'owner');
		const result = restoreTeam(db, team.id, space.actorId, Date.now());
		if (result === 'refused') throw error(404, 'No such group');
		if (result === 'name') {
			return fail(400, {
				action: 'restore',
				message: 'You already have a group with this name. Rename that one first.'
			});
		}
		return { ok: true };
	}
};
