import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { oneOf, optionalText, text } from '$lib/server/form';
import {
	archiveSong,
	restoreCount,
	retrySong,
	setAnchors,
	setCountAndSections,
	setMusicStart,
	setSampleStart,
	setSections,
	songSample,
	setTempoFactor,
	updateSongMeta,
	useAudioUrl
} from '$lib/server/songs';
import {
	addSectionAt,
	editSection,
	moveSection,
	parseSections,
	placeSections,
	removeSection,
	sectionsJson,
	type Section
} from '$lib/songs/sections';
import { suggestions } from '$lib/songs/suggest';
import { musicStart, startSource } from '$lib/songs/music-start';
import { t as words } from '$lib/i18n/catalog';
import type { Song } from '$lib/server/db/schema';
import { deleteGroupSong, shareSong, songUsers, unshareSong } from '$lib/server/song-share';
import { makeMineFrom, makeMineOffer } from '$lib/server/make-mine-form';
import {
	copyToFrom,
	detachFrom,
	dropFrom,
	keepFrom,
	sameAsFrom,
	separateFrom,
	syncFromForm
} from '$lib/server/take-form';
import { sameAsOffer } from '$lib/server/twins';
import { groupModeFor } from '$lib/server/group-mode';
import { copyOffer } from '$lib/server/clones/copy-to';
import { detachOffer } from '$lib/server/clones/detach';
import { familyView } from '$lib/server/clones/send';
import { keepView, stepStatus } from '$lib/server/clones/step';
import { dropOptions } from '$lib/server/clones/drop';
import { songSeen, seenRefusal } from '$lib/server/clash';
import { flowing, idParam } from '$lib/server/clones/flow-hook';
import { isYouTubeVideo } from '$lib/songs/source';
import { hasCopies } from '$lib/server/clones/genes';
import { audioReach } from '$lib/server/clones/audio-reach';
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
import { t } from '$lib/i18n/catalog';
import type { Actions, PageServerLoad } from './$types';

import { serverNow } from '$lib/server/server-clock';
/*
 * The song this URL names, or a 404: `requireSongAccess` checks the dance in
 * the URL, that it is not archived, and who may do what. A person's own song
 * is theirs to edit; a group's is its editors' to edit and, once shared, its
 * members' to read. Every action reaches the row by id, so each goes through
 * it; an edit needs 'edit', so a member's post gets the stranger's 404.
 */

const parse = (json: string | null): number[] => (json ? (JSON.parse(json) as number[]) : []);

/** The count as the page shows it: the scaled beats, their 1–8, and the sections on them. */
function countOf(song: Song, anchors = parse(song.anchorsJson)) {
	const grid = buildGrid({
		beats: parse(song.beatsJson),
		downbeats: parse(song.downbeatsJson),
		anchors,
		tempoFactor: song.tempoFactor as TempoFactor
	});
	const list = parseSections(song.sectionsJson);
	return { ...grid, anchors, list, placed: placeSections(list, grid.beats, grid.counts) };
}

/** A beat index the song has, or null. */
function beatOf(form: FormData, beats: number[]): number | null {
	const i = Number(form.get('beat'));
	return Number.isInteger(i) && i >= 0 && i < beats.length ? i : null;
}

/** A refused Edit change, under the control it is about. */
const refuse = (action: 'sections' | 'anchors' | 'start' | 'restore', message: string) =>
	fail(400, { action, message });

/** Undo's value for a field, read and checked; null when it does not parse. */
function restoredValue(
	field: string,
	value: string
):
	| { field: 'count'; anchors: number[]; tempo: TempoFactor }
	| { field: 'countSections'; anchors: number[]; sections: Section[] }
	| { field: 'sections'; sections: Section[] }
	| { field: 'sample' | 'start'; at: number | null }
	| null {
	let v: unknown;
	try {
		v = JSON.parse(value);
	} catch {
		return null;
	}
	if (field === 'countSections') {
		// Undo of a section that made its beat the 1: the anchors and the sections together.
		const o = v as { anchors?: unknown; sections?: unknown } | null;
		const anchors = o?.anchors;
		if (!Array.isArray(anchors) || !anchors.every((a) => Number.isInteger(a) && a >= 0))
			return null;
		if (!Array.isArray(o?.sections)) return null;
		return {
			field,
			anchors: anchors as number[],
			sections: parseSections(JSON.stringify(o.sections))
		};
	}
	if (field === 'count') {
		const o = v as { anchors?: unknown; tempo?: unknown } | null;
		const anchors = o?.anchors;
		const tempo = o?.tempo;
		if (!Array.isArray(anchors) || !anchors.every((a) => Number.isInteger(a) && a >= 0))
			return null;
		if (!(TEMPO_FACTORS as readonly unknown[]).includes(tempo)) return null;
		return { field, anchors: anchors as number[], tempo: tempo as TempoFactor };
	}
	if (field === 'sections') {
		if (!Array.isArray(v)) return null;
		return { field, sections: parseSections(value) };
	}
	if (field === 'sample' || field === 'start') {
		if (v !== null && (typeof v !== 'number' || !Number.isFinite(v))) return null;
		return { field, at: v as number | null };
	}
	return null;
}

export const load: PageServerLoad = ({ params, locals, url }) => {
	const db = getDb();
	const { song, access } = requireSongAccess(db, locals, params, params.id, 'read');
	const canEdit = access === 'edit';
	const wall = wallOf(params, locals);
	const team = song.teamId !== null ? getTeam(db, song.teamId) : null;
	// Group mode has no twins: no twin tab, no Same as….
	const inGroupMode =
		groupModeFor(db, wall.userId, wall.dance, song.teamId, locals.user?.level) !== null;
	const anchors = parse(song.anchorsJson);
	const count = song.status === 'ready' ? countOf(song, anchors) : null;
	const grid = count
		? { beats: count.beats, counts: count.counts, bpm: count.bpm, suggested: count.suggested }
		: null;
	// Only what the page shows: the raw beat lists travel as `grid`, not twice.
	return {
		song: {
			id: song.id,
			title: song.title,
			artist: song.artist,
			style: song.style,
			sourceUrl: song.sourceUrl,
			audioUrl: song.audioUrl,
			fetchedUrl: song.fetchedUrl,
			fetchedTitle: song.fetchedTitle,
			status: song.status,
			error: song.error,
			audioFile: song.audioFile,
			tempoFactor: song.tempoFactor,
			durationS: song.durationS,
			sharedAt: song.sharedAt
		},
		/** Taps, the count speed, the sample and the details: the owner's or an editor's. */
		canEdit,
		/** How many copies kept in step new audio would reach (the question before a swap). */
		copiesInStep: canEdit && song.sourceUrl ? audioReach(db, wall.userId, song.id) : 0,
		/** A tab per source, the subtitle's facts, and `?vs=` (`clones/sources.ts`). */
		...pageSources(db, wall.userId, 'song', song.id, url, !inGroupMode),
		/** Copies you can see, for the Versions list (`clones/send.ts`). */
		family: familyView(db, wall.userId, 'song', song.id),
		step: stepStatus(db, wall.userId, 'song', song.id),
		/** Keep in step under Versions, and how Sync opens (`clones/step.ts`). */
		keep: keepView(db, wall.userId, 'song', song.id),
		/** Drop my copy (board C5): the person’s own copy, while another version is readable. */
		drop: dropOptions(db, wall, 'song', song.id),
		detach: detachOffer(db, wall.userId, 'song', song.id),
		/** Same as… (board C7): the other songs in your Music; none in a group's workspace. */
		sameAs: sameAsOffer(db, wall, 'song', song.id, song.title, inGroupMode),
		/** Copy to… (board C4): your app or a group you own or edit; null when there is none. */
		copyTo: copyOffer(db, wall.userId, 'song', song.id),
		/** A group's song: whose it is. */
		group: team ? { id: team.id, name: team.name } : null,
		/** How many people's practice uses it: Stop sharing's and Delete's warning. */
		users: team && canEdit ? songUsers(db, song.id) : 0,
		/** What every edit of a group's song, or of one with copies, sends back (the clash check). */
		seen: team || hasCopies(db, 'song', song.id) ? songSeen(song) : null,
		/** A reader's Edit: Make it mine, of a group's song that is ready (ruling 12). */
		makeMine:
			canEdit || song.status !== 'ready' ? null : makeMineOffer(db, wall, 'song', song.id, team),
		/** History is its editors'. */
		historyHref:
			team && canEdit ? `/${params.dance}/groups/${team.id}/history/song/${song.id}` : null,
		anchors,
		grid,
		/** The sections on the current count, and the stored list (what Undo puts back). */
		sections: count?.placed ?? [],
		sectionsJson: sectionsJson(count?.list ?? parseSections(song.sectionsJson)),
		/** Where the music starts: where Play begins from 0:00, and whose it is. */
		start: {
			at: musicStart(song),
			source: startSource(song),
			found: song.startFoundS,
			yours: song.startS
		},
		/** Where the downbeats say the 1 moves (Edit only; never stored). */
		suggestions:
			count && canEdit
				? suggestions({
						raw: parse(song.beatsJson),
						downbeats: parse(song.downbeatsJson),
						beats: count.beats,
						counts: count.counts,
						anchors,
						placed: count.placed,
						tempoFactor: song.tempoFactor as TempoFactor
					})
				: [],
		sample: (() => {
			const sample = songSample(song);
			return sample ? { song: sample, custom: song.sampleStartS !== null } : null;
		})()
	};
};

/**
 * An edit: the song for one who edits it, the form, and the clash check's
 * refusal (or null). A group's song is checked, and so is one with copies (a
 * change may flow in while the page is open): its save without `seen` is
 * refused, and one that saw another version than the stored one is a 409
 * naming who changed it. A person's own song in no family saves as it always
 * did, `seen` or not: two quick taps of one's own must never clash.
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
	const now = serverNow();
	const refused =
		isTeam(space) || hasCopies(db, 'song', song.id)
			? seenRefusal(form, true, songSeen(song), extra(form), now, () =>
					editedBy(db, song.teamId, 'song', song.id)
				)
			: null;
	return { db, song, space, form, now, refused };
}

const named =
	<A extends string>(action: A) =>
	() => ({ action });

/** Every action runs Keep in step's flow from this song after it (`flowing`). */
export const actions: Actions = flowing('song', (e) => idParam(e.params.id), {
	/** A tap on "the 1" at playhead time `t`, snapped to the nearest beat after reaction-time compensation. */
	tap: async (event) => {
		const { db, song, space, form, now, refused } = await editing(event, named('tap'));
		if (refused) return refused;
		const at = Number(form.get('t'));
		if (!Number.isFinite(at) || song.status !== 'ready')
			return fail(400, { action: 'tap' as const, message: t().songs.page.playFirst });
		const beats = scaleBeats(parse(song.beatsJson), song.tempoFactor as TempoFactor);
		// A paused playhead is exact (a jump to a beat, then the tap): no reaction time to take off.
		const latency = form.get('paused') === '1' ? 0 : TAP_LATENCY_S;
		const i = nearestBeat(beats, at - latency);
		if (i < 0) return fail(400, { action: 'tap' as const, message: t().songs.page.noBeats });
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
			return fail(400, { action: 'tempo' as const, message: t().songs.page.badTempo });
		setTempoFactor(db, song.id, f as TempoFactor, space, now);
		return { ok: true };
	},

	/** The sample starts where the playhead `t` is; the song snaps it to a 1 when it plays. */
	sample: async (event) => {
		const { db, song, space, form, now, refused } = await editing(event, named('sample'));
		if (refused) return refused;
		const at = Number(form.get('t'));
		if (!Number.isFinite(at) || !setSampleStart(db, song.id, at, space, now))
			return fail(400, { action: 'sample' as const, message: t().songs.page.playFirst });
		return { ok: true };
	},

	sampleAuto: async (event) => {
		const { db, song, space, now, refused } = await editing(event, named('sample'));
		if (refused) return refused;
		setSampleStart(db, song.id, null, space, now);
		return { ok: true };
	},

	/** Make this the 1, Use it: a beat of the grid becomes a 1. */
	one: async (event) => {
		const { db, song, space, form, now, refused } = await editing(event, named('anchors'));
		if (refused) return refused;
		if (song.status !== 'ready') return refuse('anchors', words().songs.page.refused.beat);
		const { beats, anchors } = countOf(song);
		const i = beatOf(form, beats);
		if (i === null) return refuse('anchors', words().songs.page.refused.beat);
		setAnchors(db, song.id, addAnchor(anchors, i), space, now);
		return { ok: true };
	},

	/**
	 * A section on `beat`. A beat that is not a 1 becomes the 1 first, in the
	 * same change. Answers the new section's index in the stored list, so its
	 * sheet opens on it.
	 */
	sectionAdd: async (event) => {
		const { db, song, space, form, now, refused } = await editing(event, named('sections'));
		if (refused) return refused;
		if (song.status !== 'ready') return refuse('sections', words().songs.page.refused.beat);
		const c = countOf(song);
		const beat = beatOf(form, c.beats);
		if (beat === null) return refuse('sections', words().songs.page.refused.beat);
		const moves = c.counts[beat] !== 1;
		const anchors = moves ? addAnchor(c.anchors, beat) : c.anchors;
		const after = moves ? countOf(song, anchors) : c;
		const list = addSectionAt(after.list, after.placed, after.beats, beat);
		if (list === 'taken') return refuse('sections', words().songs.page.refused.taken);
		if (moves) setCountAndSections(db, song.id, { anchors, sections: list }, space, now);
		else setSections(db, song.id, list, space, now);
		return { ok: true, index: list.findIndex((s) => s.at === after.beats[beat]) };
	},

	sectionEdit: async (event) => {
		const { db, song, space, form, now, refused } = await editing(event, named('sections'));
		if (refused) return refused;
		const name = form.get('name');
		const countOff = form.get('countOff');
		const list = editSection(parseSections(song.sectionsJson), Number(form.get('index')), {
			...(name !== null ? { name: String(name) } : {}),
			...(countOff !== null ? { countOff: countOff === '1' } : {})
		});
		if (list === 'missing') return refuse('sections', words().songs.page.refused.missing);
		setSections(db, song.id, list, space, now);
		return { ok: true };
	},

	/** An eight earlier or later: to the neighbouring 1 that way. */
	sectionMove: async (event) => {
		const { db, song, space, form, now, refused } = await editing(event, named('sections'));
		if (refused) return refused;
		if (song.status !== 'ready') return refuse('sections', words().songs.page.refused.missing);
		const c = countOf(song);
		const dir = form.get('dir') === '-1' ? -1 : 1;
		const list = moveSection(c.list, c.placed, c.beats, c.counts, Number(form.get('index')), dir);
		if (typeof list === 'string') return refuse('sections', words().songs.page.refused[list]);
		setSections(db, song.id, list, space, now);
		return { ok: true };
	},

	sectionRemove: async (event) => {
		const { db, song, space, form, now, refused } = await editing(event, named('sections'));
		if (refused) return refused;
		const list = removeSection(parseSections(song.sectionsJson), Number(form.get('index')));
		if (list === 'missing') return refuse('sections', words().songs.page.refused.missing);
		setSections(db, song.id, list, space, now);
		return { ok: true };
	},

	sectionsClear: async (event) => {
		const { db, song, space, now, refused } = await editing(event, named('sections'));
		if (refused) return refused;
		setSections(db, song.id, [], space, now);
		return { ok: true };
	},

	/** Where the music starts: the playhead `t` (not snapped; music can start off the beat). */
	start: async (event) => {
		const { db, song, space, form, now, refused } = await editing(event, named('start'));
		if (refused) return refused;
		if (!setMusicStart(db, song.id, Number(form.get('t') ?? Number.NaN), space, now))
			return refuse('start', words().songs.page.refused.start);
		return { ok: true };
	},

	/** From 0:00: play the whole file. */
	startZero: async (event) => {
		const { db, song, space, now, refused } = await editing(event, named('start'));
		if (refused) return refused;
		setMusicStart(db, song.id, 0, space, now);
		return { ok: true };
	},

	/** Back to what the home worker found. */
	startFound: async (event) => {
		const { db, song, space, now, refused } = await editing(event, named('start'));
		if (refused) return refused;
		setMusicStart(db, song.id, null, space, now);
		return { ok: true };
	},

	/** Undo: a field as it was before the last change (the count, the sections, the sample, the start). */
	restore: async (event) => {
		const { db, song, space, form, now, refused } = await editing(event, (f) => ({
			action: String(f.get('field') ?? 'restore')
		}));
		if (refused) return refused;
		const v = restoredValue(String(form.get('field')), String(form.get('value') ?? ''));
		const ok =
			v === null
				? false
				: v.field === 'countSections'
					? setCountAndSections(db, song.id, v, space, now)
					: v.field === 'count'
						? restoreCount(db, song.id, v.anchors, v.tempo, space, now)
						: v.field === 'sections'
							? setSections(db, song.id, v.sections, space, now)
							: v.field === 'sample'
								? setSampleStart(db, song.id, v.at, space, now)
								: setMusicStart(db, song.id, v.at, space, now);
		if (!ok) return refuse('restore', words().songs.page.refused.badValue);
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
				message: t().songs.page.noTitle,
				...sent
			});
		const artist = optionalText(form, 'artist', 200);
		if (artist === undefined)
			return fail(400, {
				field: 'artist' as const,
				message: t().songs.page.longArtist,
				...sent
			});
		const style = oneOf(form, 'style', DANCES[space.dance].styles);
		if (!style) return fail(400, { message: t().songs.page.pickStyle, ...sent });
		updateSongMeta(db, song.id, { title, artist, style }, space, now);
		return { ok: true };
	},

	/** Use another YouTube link: the song downloads again from it (and its copies kept in step). */
	audio: async (event) => {
		// Every refusal, the clash check's too, names the field: Song details shows it there.
		const sentOf = (form: FormData) => ({
			field: 'audioUrl' as const,
			audioUrl: String(form.get('audioUrl') ?? '')
		});
		const { db, song, space, form, now, refused } = await editing(event, sentOf);
		if (refused) return refused;
		const words = t().songs.audio;
		const { audioUrl: typed } = sentOf(form);
		const audioUrl = typed.trim();
		const refuse = (status: number, message: string) =>
			fail(status, { field: 'audioUrl' as const, message, audioUrl });
		if (!isYouTubeVideo(audioUrl)) return refuse(400, words.notYouTube);
		// A download, like a retry: refused at or over its owner's limit.
		const room = roomForOwner(db, ownerOfRow(song), 1, Number.POSITIVE_INFINITY);
		if (!room.ok) return refuse(413, room.message);
		const done = useAudioUrl(db, song.id, audioUrl, space, now);
		if (!done.ok) {
			if (done.reason === 'missing') throw error(404, t().refusals.songNotFound);
			return refuse(409, done.reason === 'busy' ? words.busy : words.upload);
		}
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
			return fail(409, { action: 'retry' as const, message: t().songs.add.onlyFailed });
		}
		return { ok: true };
	},

	/** A person's own song leaves Music; a group's is deleted with `delete`. */
	archive: ({ params, locals }) => {
		const db = getDb();
		const { song, space } = requireSongAccess(db, locals, params, params.id, 'edit');
		if (isTeam(space)) throw error(404, t().refusals.songNotFound);
		archiveSong(db, song.id, serverNow());
		throw redirect(303, `/${params.dance}/songs`);
	},

	/** Share with the class: every member sees it. Only a ready song. */
	share: ({ params, locals }) => {
		const db = getDb();
		const { song, space } = requireSongAccess(db, locals, params, params.id, 'edit');
		if (!isTeam(space)) throw error(404, t().refusals.songNotFound);
		if (!shareSong(db, space, song.id, serverNow())) {
			return fail(400, { action: 'share' as const, message: t().songs.page.onlyReady });
		}
		return { ok: true };
	},

	/** Stop sharing: a draft again, and members' practice falls back to the count. */
	unshare: ({ params, locals }) => {
		const db = getDb();
		const { song, space } = requireSongAccess(db, locals, params, params.id, 'edit');
		if (!isTeam(space) || !unshareSong(db, space, song.id, serverNow())) {
			throw error(404, t().refusals.songNotFound);
		}
		return { ok: true };
	},

	/** Delete a group's song: to Recently deleted for 30 days, its file kept. */
	delete: ({ params, locals }) => {
		const db = getDb();
		const { song, space } = requireSongAccess(db, locals, params, params.id, 'edit');
		if (!isTeam(space) || !deleteGroupSong(db, space, song.id, serverNow())) {
			throw error(404, t().refusals.songNotFound);
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

	/** Sync (the Sync sheet, or a reader's Update mine): the merge lands on every ticked copy (`clones/sync.ts`). */
	sync: ({ params, locals, request }) => {
		const db = getDb();
		const { song } = requireSongAccess(db, locals, params, params.id, 'read');
		return syncFromForm(db, locals.user!.id, 'song', song.id, request);
	},

	/** Keep in step (under Versions): this copy's switch and options (`clones/sync-settings.ts`). */
	keep: ({ params, locals, request }) => {
		const db = getDb();
		const { song } = requireSongAccess(db, locals, params, params.id, 'read');
		return keepFrom(db, locals.user!.id, 'song', song.id, request);
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

	/** Copy to… (board C4): this song into your app or a group you own or edit. */
	copyTo: ({ params, locals, request }) => {
		const db = getDb();
		const { song } = requireSongAccess(db, locals, params, params.id, 'read');
		return copyToFrom(db, wallOf(params, locals), 'song', song.id, request);
	}
} satisfies Actions);
