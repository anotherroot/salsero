/**
 * Hearing drills on the server (spec 2026-11-10, phase 2): reading the make
 * form, making one with its songs, saving its settings, and the songs a round
 * can play.
 *
 * A hearing drill is a `custom` drill with `kind = 'hearing'`; its settings
 * live under `practice_json.hearing` (`$lib/hearing/drill`), its songs are its
 * Music (`song_links`), so walls, sharing and History come with them. Only a
 * song a person counted ever plays in a round (`counted`).
 */
import { and, asc, eq } from 'drizzle-orm';
import type { Db } from './db';
import { exercises, songLinks, songs } from './db/schema';
import { practiceSong } from './access';
import { actingIn, fieldChange, logChange } from './changes';
import { createCustomExercise, MusicRefused, type SettingsInput } from './exercises';
import type { Space } from './scope';
import { songGrid } from './grid';
import { serverNow } from './server-clock';
import {
	HEARING_DEFAULT,
	hearingOf,
	settingsFrom,
	settingsQuery,
	withHearing,
	type HearingSettings
} from '$lib/hearing/drill';
import type { Dance } from '$lib/dances/dances';
import { targetsFor } from '$lib/hearing/targets';
import { counted } from '$lib/songs/counted';
import { musicStart } from '$lib/songs/music-start';
import { parseSections } from '$lib/songs/sections';
import { t } from '$lib/i18n/catalog';
import type { SongGrid } from '$lib/types';

export interface HearingInput {
	settings: HearingSettings;
	songIds: number[];
}

/**
 * The make form's hearing half: null when the form makes a plain drill
 * (`type` is not `hearing`), the refusal's words when no song is picked.
 * Fields: `type=hearing`, `kind`, `target`, `clave`, `positions` ("3,6,7"),
 * `drops`, and `songId` once per song, in order.
 */
export function readHearingForm(form: FormData, dance: Dance): HearingInput | string | null {
	if (form.get('type') !== 'hearing') return null;
	const params = new URLSearchParams();
	for (const k of ['kind', 'target', 'clave', 'positions', 'drops']) {
		const v = form.get(k);
		if (typeof v === 'string' && v !== '') params.set(k, v);
	}
	let { settings } = settingsFrom(params, HEARING_DEFAULT);
	// A target the dance does not offer (the clave in bachata) is the default's.
	if (!targetsFor(dance).includes(settings.target)) {
		settings = settingsFrom(
			new URLSearchParams({ ...Object.fromEntries(params), target: HEARING_DEFAULT.target }),
			HEARING_DEFAULT
		).settings;
	}
	const songIds = [
		...new Set(
			form
				.getAll('songId')
				.map((v) => Number(v))
				.filter((n) => Number.isInteger(n) && n > 0)
		)
	];
	if (songIds.length === 0) return t().hearing.drill.noSongs;
	return { settings, songIds };
}

/** Why a song may not go in `space`'s hearing drill, or null when it may. */
function songRefusal(db: Db, space: Space, songId: number): string | null {
	const song = db.select().from(songs).where(eq(songs.id, songId)).get();
	if (!song || song.status !== 'ready' || song.archivedAt !== null || song.dance !== space.dance)
		return t().songs.music.cannotGo;
	if (!counted(song)) return t().hearing.drill.notCounted(song.title);
	return null;
}

/**
 * A hearing drill in `space`: the drill, its kind and settings, then its songs
 * in the order picked, all in one transaction. A song without a count of its
 * own, or one the space may not use (`addMusic`'s rules), refuses the whole
 * make: nothing is written.
 */
export function createHearingDrill(
	db: Db,
	space: Space,
	input: Omit<SettingsInput, 'active'>,
	hearing: HearingInput
): { ok: true; drill: ReturnType<typeof createCustomExercise> } | { ok: false; message: string } {
	for (const id of hearing.songIds) {
		const refused = songRefusal(db, space, id);
		if (refused) return { ok: false, message: refused };
	}
	try {
		return { ok: true, drill: createCustomExercise(db, space, { ...input, hearing }) };
	} catch (e) {
		if (e instanceof MusicRefused) return { ok: false, message: e.message };
		throw e;
	}
}

/**
 * Save a hearing drill's settings (Spremeni → Shrani, spec 13), every other
 * key of `practice_json` kept. A group's drill logs the change for History,
 * as `updateExercise` does; members' entries read the drill's settings, so it
 * reaches them at once.
 */
export function setHearingSettings(
	db: Db,
	id: number,
	settings: HearingSettings,
	by?: string,
	now = serverNow()
): boolean {
	return db.transaction((tx) => {
		const current = tx.select().from(exercises).where(eq(exercises.id, id)).get();
		if (!current || current.kind !== 'hearing') return false;
		const before = hearingOf(current.practiceJson);
		tx.update(exercises)
			.set({ practiceJson: withHearing(current.practiceJson, settings) })
			.where(eq(exercises.id, id))
			.run();
		if (current.teamId !== null) {
			const change = fieldChange(
				{ hearing: settingsQuery(before) },
				{ hearing: settingsQuery(hearingOf(withHearing(null, settings))) },
				'drill'
			);
			if (change)
				logChange(
					tx,
					actingIn(current, by),
					{ rootKind: 'drill', rootId: id, subjectId: id, verb: 'change', ...change },
					now
				);
		}
		return true;
	});
}

export interface ListenSongData {
	id: number;
	title: string;
	grid: SongGrid;
}

/**
 * A hearing drill's songs as `viewerId` may play them, in the drill's order:
 * the counted ones with their grids, and the rest with why not — `count` (no
 * count of its own), `shared` (one they may not play: unshared, deleted, not
 * analysed).
 */
export function hearingSongsOf(
	db: Db,
	viewerId: string,
	drillId: number
): {
	usable: ListenSongData[];
	blocked: { id: number; title: string; why: 'count' | 'shared' }[];
} {
	const rows = db
		.select({ song: songs })
		.from(songLinks)
		.innerJoin(songs, eq(songs.id, songLinks.songId))
		.where(and(eq(songLinks.exerciseId, drillId)))
		.orderBy(asc(songLinks.sortOrder), asc(songLinks.id))
		.all();
	const usable: ListenSongData[] = [];
	const blocked: { id: number; title: string; why: 'count' | 'shared' }[] = [];
	for (const { song } of rows) {
		if (song.status !== 'ready' || !song.audioFile || !practiceSong(db, viewerId, song)) {
			blocked.push({ id: song.id, title: song.title, why: 'shared' });
		} else if (!counted(song)) {
			blocked.push({ id: song.id, title: song.title, why: 'count' });
		} else {
			usable.push({
				id: song.id,
				title: song.title,
				grid: {
					audioFile: song.audioFile,
					...songGrid(song),
					startS: musicStart(song),
					sections: parseSections(song.sectionsJson)
				}
			});
		}
	}
	return { usable, blocked };
}

/** What Spremeni's Shrani saw of a hearing drill (the clash check): its settings, as a link reads them. */
export function hearingSeen(row: { practiceJson: string | null }): Record<string, string | null> {
	return { hearing: settingsQuery(hearingOf(row.practiceJson)) };
}
