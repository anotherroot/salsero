import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { oneOf, optionalText, text } from '$lib/server/form';
import {
	archiveSong,
	retrySong,
	setAnchors,
	setSampleStart,
	songSample,
	setTempoFactor,
	updateSongMeta
} from '$lib/server/songs';
import { deleteGroupSong, shareSong, songUsers, unshareSong } from '$lib/server/song-share';
import { makeMineFrom, makeMineOffer } from '$lib/server/make-mine-form';
import {
	copyToFrom,
	detachFrom,
	dropFrom,
	sameAsFrom,
	sendFrom,
	separateFrom,
	takeFrom
} from '$lib/server/take-form';
import { sameAsOffer } from '$lib/server/twins';
import { inGroupModeOn } from '$lib/server/group-mode';
import { copyOffer } from '$lib/server/clones/copy-to';
import { detachOffer } from '$lib/server/clones/detach';
import { familyView } from '$lib/server/clones/send';
import { dropOptions } from '$lib/server/clones/drop';
import { songSeen, seenRefusal } from '$lib/server/clash';
import { editedBy } from '$lib/server/changes';
import { getTeam } from '$lib/server/teams';
import {
	TAP_LATENCY_S,
	addAnchor,
	buildGrid,
	nearestBeat,
	removeAnchor,
	scaleBeats
} from '$lib/beatgrid/beatgrid';
import { TEMPO_FACTORS, type TempoFactor } from '$lib/labels';
import { DANCES } from '$lib/dances/dances';
import { isTeam, requireSongAccess, wallOf } from '$lib/server/scope';
import { ownerOfRow, roomForOwner } from '$lib/server/storage';
import { pageSources } from '$lib/server/clones/sources';
import type { Actions, PageServerLoad } from './$types';

/*
 * The song this URL names, or a 404: `requireSongAccess` checks the dance in
 * the URL, that it is not archived, and who may do what. A person's own song
 * is theirs to edit; a group's is its editors' to edit and, once shared, its
 * members' to read. Every action reaches the row by id, so each goes through
 * it; an edit needs 'edit', so a member's post gets the stranger's 404.
 */

const parse = (json: string | null): number[] => (json ? (JSON.parse(json) as number[]) : []);

export const load: PageServerLoad = ({ params, locals, url, cookies }) => {
	const db = getDb();
	const { song, access } = requireSongAccess(db, locals, params, params.id, 'read');
	const canEdit = access === 'edit';
	const team = song.teamId !== null ? getTeam(db, song.teamId) : null;
	// Group mode has no twins: no twin tab, no Same as….
	const inGroupMode = inGroupModeOn(
		db,
		wallOf(params, locals).userId,
		wallOf(params, locals).dance,
		song.teamId,
		cookies
	);
	const anchors = parse(song.anchorsJson);
	const grid =
		song.status === 'ready'
			? buildGrid({
					beats: parse(song.beatsJson),
					downbeats: parse(song.downbeatsJson),
					anchors,
					tempoFactor: song.tempoFactor as TempoFactor
				})
			: null;
	// Only what the page shows: the raw beat lists travel as `grid`, not twice.
	return {
		song: {
			id: song.id,
			title: song.title,
			artist: song.artist,
			style: song.style,
			sourceUrl: song.sourceUrl,
			status: song.status,
			error: song.error,
			audioFile: song.audioFile,
			tempoFactor: song.tempoFactor,
			durationS: song.durationS,
			sharedAt: song.sharedAt
		},
		/** Taps, the count speed, the sample and the details: the owner's or an editor's. */
		canEdit,
		/** A tab per source, the subtitle's facts, and `?vs=` (`clones/sources.ts`). */
		...pageSources(db, wallOf(params, locals).userId, 'song', song.id, url, !inGroupMode),
		/** Copies you can see, the differs banners and Send mine… (`clones/send.ts`). */
		family: familyView(db, wallOf(params, locals).userId, 'song', song.id),
		/** Drop my copy (board C5): the person’s own copy, while another version is readable. */
		drop: dropOptions(db, wallOf(params, locals), 'song', song.id),
		detach: detachOffer(db, wallOf(params, locals).userId, 'song', song.id),
		/** Same as… (board C7): the other songs in your Music; none in a group's workspace. */
		sameAs: sameAsOffer(db, wallOf(params, locals), 'song', song.id, song.title, inGroupMode),
		/** Copy to… (board C4): your app or a group you own or edit; null when there is none. */
		copyTo: copyOffer(db, wallOf(params, locals).userId, 'song', song.id),
		/** A group's song: whose it is. */
		group: team ? { id: team.id, name: team.name } : null,
		/** How many people's practice uses it: Stop sharing's and Delete's warning. */
		users: team && canEdit ? songUsers(db, song.id) : 0,
		/** What every edit of a group's song sends back, for the clash check. */
		seen: team ? songSeen(song) : null,
		/** A reader's Edit: Make it mine, of a group's song that is ready (ruling 12). */
		makeMine:
			canEdit || song.status !== 'ready'
				? null
				: makeMineOffer(db, wallOf(params, locals), 'song', song.id, team),
		/** History is its editors'. */
		historyHref:
			team && canEdit ? `/${params.dance}/groups/${team.id}/history/song/${song.id}` : null,
		anchors,
		grid,
		sample: (() => {
			const sample = songSample(song);
			return sample ? { song: sample, custom: song.sampleStartS !== null } : null;
		})()
	};
};

/**
 * An edit: the song for one who edits it, the form, and the clash check's
 * refusal (or null). Only a group's song is checked: its save without `seen`
 * is refused, and one that saw another version than the stored one is a 409
 * naming who changed it. A person's own song saves as it always did, `seen`
 * or not: two quick taps of one's own must never clash.
 */
async function editing<T extends Record<string, unknown>>(
	event: { params: { dance: string; id: string }; locals: App.Locals; request: Request },
	extra: (form: FormData) => T
) {
	const db = getDb();
	const { song, space } = requireSongAccess(
		db,
		event.locals,
		event.params,
		event.params.id,
		'edit'
	);
	const form = await event.request.formData();
	const now = Date.now();
	const refused = isTeam(space)
		? seenRefusal(form, true, songSeen(song), extra(form), now, () =>
				editedBy(db, song.teamId, 'song', song.id)
			)
		: null;
	return { db, song, space, form, now, refused };
}

const named =
	<A extends string>(action: A) =>
	() => ({ action });

export const actions: Actions = {
	/** A tap on "the 1" at playhead time `t`, snapped to the nearest beat after reaction-time compensation. */
	tap: async (event) => {
		const { db, song, space, form, now, refused } = await editing(event, named('tap'));
		if (refused) return refused;
		const t = Number(form.get('t'));
		if (!Number.isFinite(t) || song.status !== 'ready')
			return fail(400, { action: 'tap' as const, message: 'Play the song first.' });
		const beats = scaleBeats(parse(song.beatsJson), song.tempoFactor as TempoFactor);
		const i = nearestBeat(beats, t - TAP_LATENCY_S);
		if (i < 0) return fail(400, { action: 'tap' as const, message: 'No beats to snap to.' });
		setAnchors(db, song.id, addAnchor(parse(song.anchorsJson), i), space, now);
		return { ok: true };
	},

	removeAnchor: async (event) => {
		const { db, song, space, form, now, refused } = await editing(event, named('anchors'));
		if (refused) return refused;
		const i = Number(form.get('beat'));
		setAnchors(db, song.id, removeAnchor(parse(song.anchorsJson), i), space, now);
		return { ok: true };
	},

	resetAnchors: async (event) => {
		const { db, song, space, now, refused } = await editing(event, named('anchors'));
		if (refused) return refused;
		setAnchors(db, song.id, [], space, now);
		return { ok: true };
	},

	tempo: async (event) => {
		const { db, song, space, form, now, refused } = await editing(event, named('tempo'));
		if (refused) return refused;
		const f = Number(form.get('factor'));
		if (!(TEMPO_FACTORS as readonly number[]).includes(f))
			return fail(400, { action: 'tempo' as const, message: 'Bad tempo.' });
		setTempoFactor(db, song.id, f as TempoFactor, space, now);
		return { ok: true };
	},

	/** The sample starts where the playhead `t` is; the song snaps it to a 1 when it plays. */
	sample: async (event) => {
		const { db, song, space, form, now, refused } = await editing(event, named('sample'));
		if (refused) return refused;
		const t = Number(form.get('t'));
		if (!Number.isFinite(t) || !setSampleStart(db, song.id, t, space, now))
			return fail(400, { action: 'sample' as const, message: 'Play the song first.' });
		return { ok: true };
	},

	sampleAuto: async (event) => {
		const { db, song, space, now, refused } = await editing(event, named('sample'));
		if (refused) return refused;
		setSampleStart(db, song.id, null, space, now);
		return { ok: true };
	},

	update: async (event) => {
		// Song details' refusals carry what was typed (`title` marks them as the sheet's).
		const sentOf = (form: FormData) => ({
			title: String(form.get('title') ?? ''),
			artist: String(form.get('artist') ?? ''),
			style: String(form.get('style') ?? '')
		});
		const { db, song, space, form, now, refused } = await editing(event, sentOf);
		if (refused) return refused;
		const sent = sentOf(form);
		const title = text(form, 'title');
		if (!title)
			return fail(400, {
				field: 'title' as const,
				message: 'Give the song a title (up to 200 characters).',
				...sent
			});
		const artist = optionalText(form, 'artist', 200);
		if (artist === undefined)
			return fail(400, {
				field: 'artist' as const,
				message: 'Keep the artist to 200 characters.',
				...sent
			});
		const style = oneOf(form, 'style', DANCES[space.dance].styles);
		if (!style) return fail(400, { message: 'Pick a style.', ...sent });
		updateSongMeta(db, song.id, { title, artist, style }, space, now);
		return { ok: true };
	},

	retry: ({ params, locals }) => {
		const db = getDb();
		const { song } = requireSongAccess(db, locals, params, params.id, 'edit');
		// A retry downloads again: refused at or over its owner's limit (the group's for its song).
		const room = roomForOwner(db, ownerOfRow(song), 1, Number.POSITIVE_INFINITY);
		if (!room.ok) return fail(413, { action: 'retry' as const, message: room.message });
		// Not logged in History, on a group song too: a retry only re-queues the
		// worker (status), like the worker's own writes, and no field changes.
		if (!retrySong(db, song.id)) {
			return fail(409, { action: 'retry' as const, message: 'Only a failed song can be retried.' });
		}
		return { ok: true };
	},

	/** A person's own song leaves Music; a group's is deleted with `delete`. */
	archive: ({ params, locals }) => {
		const db = getDb();
		const { song, space } = requireSongAccess(db, locals, params, params.id, 'edit');
		if (isTeam(space)) throw error(404, 'Song not found');
		archiveSong(db, song.id, Date.now());
		throw redirect(303, `/${params.dance}/songs`);
	},

	/** Share with the class: every member sees it. Only a ready song. */
	share: ({ params, locals }) => {
		const db = getDb();
		const { song, space } = requireSongAccess(db, locals, params, params.id, 'edit');
		if (!isTeam(space)) throw error(404, 'Song not found');
		if (!shareSong(db, space, song.id, Date.now())) {
			return fail(400, { action: 'share' as const, message: 'Only a ready song can be shared.' });
		}
		return { ok: true };
	},

	/** Stop sharing: a draft again, and members' practice falls back to the count. */
	unshare: ({ params, locals }) => {
		const db = getDb();
		const { song, space } = requireSongAccess(db, locals, params, params.id, 'edit');
		if (!isTeam(space) || !unshareSong(db, space, song.id, Date.now())) {
			throw error(404, 'Song not found');
		}
		return { ok: true };
	},

	/** Delete a group's song: to Recently deleted for 30 days, its file kept. */
	delete: ({ params, locals }) => {
		const db = getDb();
		const { song, space } = requireSongAccess(db, locals, params, params.id, 'edit');
		if (!isTeam(space) || !deleteGroupSong(db, space, song.id, Date.now())) {
			throw error(404, 'Song not found');
		}
		throw redirect(303, `/${params.dance}/songs`);
	},

	/**
	 * Make it mine: a reader's own song with the teacher's count, the audio
	 * linked and charged to them, their practice moved onto it, and it opens
	 * (`clones/edit.ts`). One that does not fit says so, with Ask for more when
	 * their limit is why.
	 */
	makeMine: ({ params, locals }) => {
		const db = getDb();
		const { song } = requireSongAccess(db, locals, params, params.id, 'read');
		return makeMineFrom(db, wallOf(params, locals), 'song', song.id);
	},

	/** Take theirs: the compare sheet's picks from another member of the family, in place (`clones/compare.ts`). */
	take: ({ params, locals, request }) => {
		const db = getDb();
		const { song } = requireSongAccess(db, locals, params, params.id, 'read');
		return takeFrom(db, locals.user!.id, 'song', song.id, request);
	},

	/** Send mine (board C3 p2): this song's changes into each copy the person edits. */
	send: ({ params, locals, request }) => {
		const db = getDb();
		const { song } = requireSongAccess(db, locals, params, params.id, 'read');
		return sendFrom(db, locals.user!.id, 'song', song.id, request);
	},

	/** Drop my copy (board C5): this song goes for the class’s, whose page opens. */
	drop: ({ params, locals, request }) => {
		const db = getDb();
		const { song } = requireSongAccess(db, locals, params, params.id, 'read');
		return dropFrom(db, wallOf(params, locals), 'song', song.id, request);
	},

	/** Detach (board C8): this copy stops following its source. */
	detach: ({ params, locals }) => {
		const { song } = requireSongAccess(getDb(), locals, params, params.id, 'read');
		return detachFrom(getDb(), wallOf(params, locals).userId, 'song', song.id);
	},

	/** Copy to… (board C4): this song into your app or a group you own or edit. */
	/** Same as… (board C7): the row's twins become exactly the ticked ones. */
	sameAs: ({ params, locals, request }) => {
		const { song } = requireSongAccess(getDb(), locals, params, params.id, 'read');
		return sameAsFrom(getDb(), wallOf(params, locals), 'song', song.id, request);
	},

	/** Not the same? Separate (board C7 p2). */
	separate: ({ params, locals }) => {
		const { song } = requireSongAccess(getDb(), locals, params, params.id, 'read');
		return separateFrom(getDb(), wallOf(params, locals), 'song', song.id);
	},

	copyTo: ({ params, locals, request }) => {
		const db = getDb();
		const { song } = requireSongAccess(db, locals, params, params.id, 'read');
		return copyToFrom(db, wallOf(params, locals), 'song', song.id, request);
	}
};
