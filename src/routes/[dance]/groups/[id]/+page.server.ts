import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { inviteQr } from '$lib/server/invites';
import { createLesson, getLessonRow, listTeamLessons } from '$lib/server/lessons';
import { readNewLesson } from '$lib/server/lesson-form';
import { readAdd } from '$lib/server/add-form';
import { addLesson, addState } from '$lib/server/entries';
import { localDay } from '$lib/day/day';
import { teamLimitBytes, usedBytesOf } from '$lib/server/storage';
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
		lessons: deleted
			? []
			: listTeamLessons(db, space.actorId, team.id, role).map((l) => ({
					...l,
					// "Added ✓", or Add and its sheet; nothing on a draft.
					add: l.publishedAt === null ? null : addState(db, space.actorId, l.id)
				})),
		canEdit: !deleted && role !== 'member',
		// "Uses X of Y", for those who may delete files.
		storage:
			!deleted && role !== 'member'
				? {
						usedBytes: usedBytesOf(db, { teamId: team.id }),
						limitBytes: teamLimitBytes(db, team.id)
					}
				: null,
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

	/**
	 * Add one of the group's published lessons to one's own, with the picks
	 * ticked on its sheet. Any member may; a draft, or a lesson of another
	 * group, is the stranger's 404.
	 */
	add: async ({ params, locals, request }) => {
		const db = getDb();
		const { team, space } = requireTeam(db, locals, params, 'member');
		const { lessonId, picks } = readAdd(await request.formData());
		const lesson = lessonId === undefined ? null : getLessonRow(db, lessonId);
		if (!lesson || lesson.teamId !== team.id) throw error(404, 'No such lesson');
		if (!addLesson(db, space.actorId, lesson.id, picks, Date.now())) {
			throw error(404, 'No such lesson');
		}
		return { action: 'add', ok: true };
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
