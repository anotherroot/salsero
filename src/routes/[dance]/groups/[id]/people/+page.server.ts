import { error, fail } from '@sveltejs/kit';
import { t } from '$lib/i18n/catalog';
import { getDb } from '$lib/server/db';
import { requireTeam } from '$lib/server/scope';
import { handOver, peopleOf } from '$lib/server/teams';
import { removeMember, setRole } from '$lib/server/membership';
import { realCloneFiles } from '$lib/server/clones/files';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, locals }) => {
	const db = getDb();
	const { team, role } = requireTeam(db, locals, params, 'member');
	if (team.deletedAt !== null) throw error(404, t().groups.page.noGroup);
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
	if (team.deletedAt !== null) throw error(404, t().groups.page.noGroup);
	const form = await event.request.formData();
	const userId = String(form.get('userId') ?? '');
	if (!peopleOf(db, team.id).some((p) => p.id === userId))
		throw error(404, t().groups.people.noPerson);
	return { db, team, ownerId: space.actorId, userId, form };
}

export const actions: Actions = {
	role: async (event) => {
		const { db, team, userId, form } = await target(event);
		const role = String(form.get('role') ?? '');
		if (role !== 'editor' && role !== 'member')
			return fail(400, { message: t().groups.people.pickRole });
		if (!setRole(db, team.id, userId, role, Date.now())) {
			return fail(400, { message: t().groups.people.ownerKeeps });
		}
		return { ok: true };
	},

	handOver: async (event) => {
		const { db, team, ownerId, userId } = await target(event);
		const result = handOver(db, team.id, ownerId, userId);
		if (result === 'limit') {
			return fail(400, { message: t().groups.people.ownsEnough });
		}
		if (result === 'not-member') return fail(400, { message: t().groups.people.pickSomeone });
		return { ok: true };
	},

	remove: async (event) => {
		const { db, team, userId } = await target(event);
		let removed: boolean;
		try {
			removed = await removeMember(db, team.id, userId, realCloneFiles(), Date.now());
		} catch (err) {
			console.error(`[groups] removing ${userId} from group ${team.id} failed`, err);
			return fail(500, { action: 'remove', message: t().groups.people.keepFailed });
		}
		if (!removed) {
			return fail(400, { message: t().groups.people.ownerStays });
		}
		return { ok: true };
	}
};
