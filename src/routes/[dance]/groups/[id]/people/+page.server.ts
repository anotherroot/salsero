import { error, fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { requireTeam } from '$lib/server/scope';
import { handOver, peopleOf, removeMember, setRole } from '$lib/server/teams';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, locals }) => {
	const db = getDb();
	const { team, role } = requireTeam(db, locals, params, 'member');
	if (team.deletedAt !== null) throw error(404, 'No such group');
	return {
		team: { id: team.id, name: team.name },
		role,
		me: locals.user!.id,
		people: peopleOf(db, team.id)
	};
};

/** The owner of a live group, and the person the form names (who must be in it). */
async function target(event: Parameters<NonNullable<Actions[string]>>[0]) {
	const db = getDb();
	const { team, space } = requireTeam(db, event.locals, event.params, 'owner');
	if (team.deletedAt !== null) throw error(404, 'No such group');
	const form = await event.request.formData();
	const userId = String(form.get('userId') ?? '');
	if (!peopleOf(db, team.id).some((p) => p.id === userId)) throw error(404, 'No such person');
	return { db, team, ownerId: space.actorId, userId, form };
}

export const actions: Actions = {
	role: async (event) => {
		const { db, team, userId, form } = await target(event);
		const role = String(form.get('role') ?? '');
		if (role !== 'editor' && role !== 'member') return fail(400, { message: 'Pick a role.' });
		if (!setRole(db, team.id, userId, role)) {
			return fail(400, { message: 'The owner keeps the group. Hand it over to change that.' });
		}
		return { ok: true };
	},

	handOver: async (event) => {
		const { db, team, ownerId, userId } = await target(event);
		const result = handOver(db, team.id, ownerId, userId);
		if (result === 'limit') {
			return fail(400, { message: 'That person already owns as many groups as they may make.' });
		}
		if (result === 'not-member') return fail(400, { message: 'Pick someone else in the group.' });
		return { ok: true };
	},

	remove: async (event) => {
		const { db, team, userId } = await target(event);
		if (!removeMember(db, team.id, userId)) {
			return fail(400, { message: 'The owner cannot be removed. Hand the group over first.' });
		}
		return { ok: true };
	}
};
