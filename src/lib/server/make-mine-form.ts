/**
 * Make it mine on an item page (figure, routine, drill, song, lesson): what
 * its load offers a reader, and its `makeMine` action. The data side is
 * `clones/edit.ts`; this is the route's share: the real files, the free
 * disk, the redirect to the copy and the refusals' answers.
 */
import { error, fail, redirect } from '@sveltejs/kit';
import type { CloneKind, MakeMineOffer } from '$lib/types';
import type { Db } from './db';
import type { Wall } from './scope';
import { freeDisk } from './storage';
import { realCloneFiles } from './clones/files';
import { makeMine, makeMinePreview } from './clones/edit';
import { serverNow } from '$lib/server/server-clock';

const PAGE: Record<CloneKind, string> = {
	figure: 'figures',
	routine: 'routines',
	drill: 'exercises',
	song: 'songs',
	lesson: 'lessons',
	position: 'positions'
};

/** The page of a person's row of the kind. */
export const itemHref = (wall: Wall, kind: CloneKind, id: number) =>
	`/${wall.dance}/${PAGE[kind]}/${id}`;

/**
 * What a reader's Edit opens (the Make it mine sheet), or null for anyone
 * who may not make it theirs: an editor (their Edit edits the group's row,
 * ruling 1), a person's own row, an archived one.
 */
export function makeMineOffer(
	db: Db,
	wall: Wall,
	kind: CloneKind,
	id: number,
	team: { name: string } | null
): MakeMineOffer | null {
	if (!team) return null;
	const p = makeMinePreview(db, wall, kind, id);
	if (!p) return null;
	return {
		kind,
		label: p.title,
		team: team.name,
		repoint: {
			routines: p.repoint.routines,
			lessons: p.repoint.lessons,
			sections: p.repoint.sections,
			entries: p.repoint.entries,
			figures: p.repoint.figures
		},
		practised: p.practised,
		bytes: p.bytes,
		existing: p.existing
	};
}

/**
 * The `makeMine` action: the copy, then its page (303). Refused, writing
 * nothing: for room (413, with Ask for more when the person's limit is the
 * reason), for a name or an archived song copy (409). Anyone who may not is
 * the missing row's 404.
 */
export async function makeMineFrom(db: Db, wall: Wall, kind: CloneKind, id: number) {
	const bytes = makeMinePreview(db, wall, kind, id)?.bytes ?? 0;
	const res = await makeMine(db, wall, kind, id, realCloneFiles(), serverNow(), await freeDisk());
	if (res.ok) throw redirect(303, itemHref(wall, kind, res.id));
	switch (res.reason) {
		case 'room': {
			const room = res.room;
			if (room.ok) throw error(500, 'Refused without a reason');
			const askForMore = room.limitBytes !== null && room.usedBytes + bytes > room.limitBytes;
			return fail(413, { action: 'makeMine' as const, message: room.message, askForMore });
		}
		case 'name':
		case 'archived':
			return fail(409, { action: 'makeMine' as const, message: res.message, askForMore: false });
		case 'denied':
			throw error(404, 'Not found');
	}
}
