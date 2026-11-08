import { t } from '$lib/i18n/catalog';
import { error, fail, redirect } from '@sveltejs/kit';
import { getDb, type Db } from '$lib/server/db';
import { inviteQr } from '$lib/server/invites';
import { createLesson, getLessonRow, listTeamLessons } from '$lib/server/lessons';
import { readNewLesson } from '$lib/server/lesson-form';
import { readAdd } from '$lib/server/add-form';
import { addLesson, addOffer, addState, defaultPicks } from '$lib/server/entries';
import { autoAddStored, setAutoAdd } from '$lib/server/levels';
import { int } from '$lib/server/form';
import {
	addsAtOnce,
	autoAddOn,
	autoAddSwitchShown,
	levelShown,
	simpleClass
} from '$lib/levels/levels';
import { localDay } from '$lib/day/day';
import { whatsNew } from '$lib/server/whats-new';
import { listSongs } from '$lib/server/songs';
import { teamLimitBytes, usedBytesOf } from '$lib/server/storage';
import { requireTeam } from '$lib/server/scope';
import { deleteTeam, peopleOf, remakeCode, renameTeam, restoreTeam } from '$lib/server/teams';
import { leaveTeam } from '$lib/server/membership';
import { readKeepChoice } from '$lib/server/keep-form';
import { realCloneFiles } from '$lib/server/clones/files';
import { codeLink, NAME_REFUSAL } from '$lib/teams/view';
import type { Actions, PageServerLoad } from './$types';

/** How many things a class puts on Today: `addOffer`'s ticked items (the default picks). */
function practiseCount(db: Db, userId: string, lessonId: number): number {
	return addOffer(db, userId, lessonId)?.items.filter((i) => i.ticked).length ?? 0;
}

export const load: PageServerLoad = ({ params, locals, url }) => {
	const db = getDb();
	const { team, role, space } = requireTeam(db, locals, params, 'member');
	const deleted = team.deletedAt !== null;
	const news = whatsNew(db, space.actorId, space.dance);
	const fresh = news.lessons;
	// The code is for those who may hand it out; a deleted group shows nothing but Restore.
	const link = !deleted && role !== 'member' ? codeLink(url.origin, team.code) : null;
	const level = levelShown(locals.user!.level);
	// My class: a member at Follow my class sees the class page, simple (`MyClass`).
	const simple = !deleted && simpleClass(level, role);
	return {
		simple,
		// "Add new lessons to Today automatically": the member's own switch, at the two upper levels.
		autoAdd:
			!deleted && autoAddSwitchShown(level)
				? { on: autoAddOn(level, autoAddStored(db, space.actorId, team.id)) }
				: null,
		// Below Everything, Add adds the default picks at once (`addNow`), without the sheet.
		addAtOnce: addsAtOnce(level),
		team: { id: team.id, name: team.name, deletedAt: team.deletedAt },
		role,
		people: peopleOf(db, team.id).length,
		code: link ? { link, qr: inviteQr(link) } : null,
		// An editor's list starts with the drafts; a member's holds the published ones only.
		lessons: deleted
			? []
			: listTeamLessons(db, space.actorId, team.id, role).map((l) => ({
					...l,
					isNew: fresh.has(l.id),
					// "Added ✓", or Add and its sheet; nothing on a draft.
					add: l.publishedAt === null ? null : addState(db, space.actorId, l.id),
					// My class's "4 to practise": what Add puts on Today (the lesson, its routines and drills).
					practise: simple ? practiseCount(db, space.actorId, l.id) : 0
				})),
		// Class songs: the shared ones; an editor's list starts with the drafts.
		songs: deleted
			? []
			: listSongs(db, space)
					.filter((s) => role !== 'member' || (s.sharedAt !== null && s.status === 'ready'))
					.map((s) => ({ ...s, draft: s.sharedAt === null, isNew: news.songs.has(s.id) })),
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
			localDay(Date.now(), locals.user!.timezone)
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

	/**
	 * Add with one tap: the lesson, its routines and drills (the sheet's
	 * defaults), no sheet. A lesson the person may not add, or one of another
	 * group, is refused with a message (posted with `act`, which shows it).
	 */
	addNow: async ({ params, locals, request }) => {
		const db = getDb();
		const { team, space } = requireTeam(db, locals, params, 'member');
		const lessonId = int(await request.formData(), 'lessonId');
		const lesson = lessonId === undefined ? null : getLessonRow(db, lessonId);
		const offer =
			lesson && lesson.teamId === team.id ? addOffer(db, space.actorId, lesson.id) : null;
		if (!lesson || !offer)
			return fail(404, { action: 'addNow', message: t().groups.page.noLesson });
		if (!addLesson(db, space.actorId, lesson.id, defaultPicks(offer), Date.now())) {
			return fail(404, { action: 'addNow', message: t().groups.page.noLesson });
		}
		return { action: 'addNow', ok: true };
	},

	/** The member's "Add new lessons to Today automatically" switch; from the next publish on. */
	autoAdd: async ({ params, locals, request }) => {
		const db = getDb();
		const { team, space } = requireTeam(db, locals, params, 'member');
		if (team.deletedAt !== null)
			return fail(404, { action: 'autoAdd', message: t().groups.page.noGroup });
		const on = (await request.formData()).get('on');
		if (on !== '1' && on !== '0')
			return fail(400, { action: 'autoAdd', message: t().groups.page.couldNotSave });
		setAutoAdd(db, space.actorId, team.id, on === '1');
		return { action: 'autoAdd', ok: true };
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

	leave: async ({ params, locals, request }) => {
		const db = getDb();
		const { team, space } = requireTeam(db, locals, params, 'member');
		if (team.deletedAt !== null) throw error(404, 'No such group');
		// What to keep comes from the leave sheet; no choice is no leaving.
		const choice = readKeepChoice(await request.formData());
		if (!choice) return fail(400, { action: 'leave', message: t().groups.page.chooseKeep });
		let left: 'left' | 'owner';
		try {
			left = await leaveTeam(db, team.id, space.actorId, choice, realCloneFiles(), Date.now());
		} catch (err) {
			console.error(`[groups] leaving group ${team.id} failed for ${space.actorId}`, err);
			return fail(500, { action: 'leave', message: t().groups.page.keepFailed });
		}
		if (left === 'owner') {
			return fail(400, { action: 'leave', message: t().groups.page.handOverFirst });
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
