/*
 * Videos kept on the phone (offline phase 4b): what this device keeps, read
 * from its copy. A switched-on space keeps every video of its lessons, old
 * and new; a video can also be kept by itself (a lesson's or a figure's
 * recording). The settings are this device's, in `device_meta` under `keep`,
 * so another person (the copy wiped) starts from the default. The copy is
 * already walled (`syncScope`): what it holds, the person may watch, and a
 * row gone from it (a group left, a lesson archived) is no longer wanted.
 */
import type { MediaFile, MediaKind } from '$lib/offline/media-store';
import type { KeepChange, KeepSettings, KeptVideo, SpaceId, SpaceRow } from '$lib/offline/protocol';
import { writeMetaValue, type SqliteDb } from './migrate';

export const KEEP_META = 'keep';
export const DEFAULT_KEEP: KeepSettings = { spaces: [], wifiOnly: true, videos: [] };

const strings = (v: unknown): v is string[] =>
	Array.isArray(v) && v.every((x) => typeof x === 'string');

export function readKeep(db: SqliteDb): KeepSettings {
	const row = db.prepare('SELECT value FROM device_meta WHERE key = ?').get(KEEP_META) as
		{ value: string } | undefined;
	if (!row) return DEFAULT_KEEP;
	try {
		const v = JSON.parse(row.value) as Partial<KeepSettings>;
		if (strings(v.spaces) && strings(v.videos) && typeof v.wifiOnly === 'boolean') {
			return { spaces: v.spaces, wifiOnly: v.wifiOnly, videos: v.videos };
		}
	} catch {
		// Unreadable: the default.
	}
	return DEFAULT_KEEP;
}

export function writeKeep(db: SqliteDb, s: KeepSettings): void {
	writeMetaValue(db, KEEP_META, JSON.stringify(s));
}

const toggle = (list: string[], x: string, on: boolean) =>
	on ? (list.includes(x) ? list : [...list, x]) : list.filter((y) => y !== x);

/** The settings after one change. Clear switches every space and video off; Wi-Fi stays. */
export function applyKeepChange(s: KeepSettings, c: KeepChange): KeepSettings {
	if ('clear' in c) return { ...s, spaces: [], videos: [] };
	if ('wifiOnly' in c) return { ...s, wifiOnly: c.wifiOnly };
	if ('space' in c) return { ...s, spaces: toggle(s.spaces, c.space, c.on) };
	return { ...s, videos: toggle(s.videos, c.video, c.on) };
}

const key = (kind: MediaKind, file: string) => `${kind}/${file}`;

type SpaceVideo = { file: string; mime: string; size: number; space: SpaceId };

/**
 * Every lesson video of the person's spaces in the copy, newest lesson first. Never a
 * phone-only one (offline phase 4c): its original is on the phone that holds it, and
 * nowhere to download it from.
 */
function spaceVideos(db: SqliteDb, userId: string): SpaceVideo[] {
	const rows = db
		.prepare(
			`SELECT lv.file, lv.mime, lv.size_bytes AS size, l.user_id AS user, l.team_id AS team
			 FROM lesson_videos lv JOIN lessons l ON l.id = lv.lesson_id
			 WHERE l.archived_at IS NULL AND lv.server_copy = 1
			   AND (l.user_id = ? OR l.team_id IN (
			     SELECT tm.team_id FROM team_members tm JOIN teams t ON t.id = tm.team_id
			     WHERE tm.user_id = ? AND t.deleted_at IS NULL))
			 ORDER BY l.lesson_day DESC, lv.id DESC`
		)
		.all(userId, userId) as {
		file: string;
		mime: string;
		size: number;
		user: string | null;
		team: number | null;
	}[];
	return rows.map((r) => ({
		file: r.file,
		mime: r.mime,
		size: r.size,
		space: r.user === userId ? 'mine' : `team:${r.team}`
	}));
}

/** The videos to keep: the switched-on spaces' and each kept one, newest lesson first, kept recordings after. */
export function wantedVideos(db: SqliteDb, userId: string, s: KeepSettings): MediaFile[] {
	const kept = new Set(s.videos);
	const lessonsOn = spaceVideos(db, userId)
		.filter((v) => s.spaces.includes(v.space) || kept.has(key('lesson-videos', v.file)))
		.map((v): MediaFile => ({ kind: 'lesson-videos', file: v.file, mime: v.mime, size: v.size }));
	const recordingFiles = s.videos
		.filter((k) => k.startsWith('recordings/'))
		.map((k) => k.slice('recordings/'.length));
	const recordings = recordingFiles.length
		? (db
				.prepare(
					`SELECT file, mime, size_bytes AS size FROM recordings
					 WHERE kind = 'video' AND server_copy = 1 AND file IN (${recordingFiles.map(() => '?').join(', ')})
					 ORDER BY created_at DESC, id DESC`
				)
				.all(...recordingFiles) as { file: string; mime: string; size: number }[])
		: [];
	return [...lessonsOn, ...recordings.map((r): MediaFile => ({ kind: 'recordings', ...r }))];
}

/** My lessons, then each group the person is in, with what each holds and how much is on the phone. */
export function spaceRows(
	db: SqliteDb,
	userId: string,
	s: KeepSettings,
	held: ReadonlySet<string>
): SpaceRow[] {
	const teams = db
		.prepare(
			`SELECT t.id, t.name FROM teams t JOIN team_members tm ON tm.team_id = t.id
			 WHERE tm.user_id = ? AND t.deleted_at IS NULL ORDER BY t.name`
		)
		.all(userId) as { id: number; name: string }[];
	const rows: SpaceRow[] = [
		{ id: 'mine', name: null },
		...teams.map((t) => ({ id: `team:${t.id}`, name: t.name }))
	].map((r) => ({ ...r, on: s.spaces.includes(r.id), videos: 0, bytes: 0, held: 0, heldBytes: 0 }));
	const byId = new Map(rows.map((r) => [r.id, r]));
	for (const v of spaceVideos(db, userId)) {
		const row = byId.get(v.space);
		if (!row) continue;
		row.videos++;
		row.bytes += v.size;
		if (held.has(key('lesson-videos', v.file))) {
			row.held++;
			row.heldBytes += v.size;
		}
	}
	return rows;
}

/** The videos kept by themselves that are still in the copy, with what to call them. */
export function keptVideos(db: SqliteDb, s: KeepSettings, held: ReadonlySet<string>): KeptVideo[] {
	const out: KeptVideo[] = [];
	for (const k of s.videos) {
		const [kind, file] = [k.slice(0, k.indexOf('/')), k.slice(k.indexOf('/') + 1)];
		if (kind === 'lesson-videos') {
			const r = db
				.prepare(
					`SELECT lv.size_bytes AS size, l.title,
					   (SELECT count(*) FROM lesson_videos o WHERE o.lesson_id = lv.lesson_id AND o.id <= lv.id) AS place
					 FROM lesson_videos lv JOIN lessons l ON l.id = lv.lesson_id WHERE lv.file = ?`
				)
				.get(file) as { size: number; title: string; place: number } | undefined;
			if (r) out.push({ key: k, title: r.title, index: r.place, bytes: r.size, held: held.has(k) });
		} else if (kind === 'recordings') {
			const r = db
				.prepare(
					`SELECT r.size_bytes AS size, f.name AS title FROM recordings r
					 JOIN figures f ON f.id = r.figure_id WHERE r.file = ? AND r.kind = 'video'`
				)
				.get(file) as { size: number; title: string } | undefined;
			if (r) out.push({ key: k, title: r.title, index: null, bytes: r.size, held: held.has(k) });
		}
	}
	return out;
}

/** The video keys a switched-on space keeps → that space. */
export function keptBySpace(
	db: SqliteDb,
	userId: string,
	s: KeepSettings
): Record<string, SpaceId> {
	const out: Record<string, SpaceId> = {};
	for (const v of spaceVideos(db, userId)) {
		if (s.spaces.includes(v.space)) out[key('lesson-videos', v.file)] = v.space;
	}
	return out;
}
