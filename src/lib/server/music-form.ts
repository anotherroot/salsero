/**
 * The Music actions every page with a Music list shares (spec B): `addSong`,
 * `noteSong` (a group's carries `seen`, the clash check) and `removeSong`. The
 * page decides the space and the parent (and that the asker may edit them).
 */
import { fail } from '@sveltejs/kit';
import type { Db } from './db';
import { int } from './form';
import { isTeam, type Space } from './scope';
import { seenRefusal } from './clash';
import {
	addMusic,
	musicLinkIn,
	musicNote,
	musicSeen,
	removeMusic,
	setMusicNote
} from './song-links';
import type { MusicParent } from '$lib/types';

const NOTE_TOO_LONG = 'A note is up to 500 characters.';
const GONE = 'That song was already removed.';

export async function addSongFrom(request: Request, db: Db, space: Space, parent: MusicParent) {
	const form = await request.formData();
	const typed = { action: 'addSong' as const, note: String(form.get('note') ?? '') };
	const note = musicNote(form.get('note'));
	if (note === undefined)
		return fail(400, { ...typed, field: 'note' as const, message: NOTE_TOO_LONG });
	const songId = int(form, 'songId');
	if (songId === undefined) return fail(400, { ...typed, message: 'Pick a song.' });
	const added = addMusic(db, space, parent, songId, note, Date.now());
	if (!added.ok) return fail(400, { ...typed, message: added.message });
	return { action: 'addSong' as const, ok: true };
}

export async function noteSongFrom(request: Request, db: Db, space: Space, parent: MusicParent) {
	const form = await request.formData();
	const linkId = int(form, 'linkId');
	const typed = {
		action: 'noteSong' as const,
		linkId: linkId ?? null,
		note: String(form.get('note') ?? '')
	};
	const note = musicNote(form.get('note'));
	if (note === undefined) {
		return fail(400, { ...typed, field: 'note' as const, message: NOTE_TOO_LONG });
	}
	// The page's own row first: another's (or a missing one) is the same 404, and
	// the clash check never answers with what someone else's note says.
	const found = linkId === undefined ? null : musicLinkIn(db, space, linkId, parent);
	if (!found) return fail(404, { ...typed, message: GONE });
	const clash = seenRefusal(form, isTeam(space), musicSeen(found.link), typed);
	if (clash) return clash;
	if (!setMusicNote(db, space, found.link.id, note, Date.now(), parent)) {
		return fail(404, { ...typed, message: GONE });
	}
	return { action: 'noteSong' as const, ok: true };
}

export async function removeSongFrom(request: Request, db: Db, space: Space, parent: MusicParent) {
	const linkId = int(await request.formData(), 'linkId');
	if (linkId === undefined || !removeMusic(db, space, linkId, Date.now(), parent)) {
		return fail(404, { action: 'removeSong' as const, message: GONE });
	}
	return { action: 'removeSong' as const, ok: true };
}
