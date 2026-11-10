/**
 * The video sections experiment (AI connector plan 3): the AI looks at a
 * lesson video or a video recording through frames every 2 s and, where it
 * can hear, the sound, then proposes sections into the queue (`propose`,
 * `add_section`). Reading goes through `viewOf`, so another person's video
 * answers as a missing one. The only write is the video's `ai_timelines` row,
 * queued on the first look; the home worker prepares it.
 */
import type { ToolDef, ToolResult } from '$lib/mcp/protocol';
import { deviceLabelFor } from '../clones/phone-only';
import type { SpotOwner } from '$lib/types';
import { refuse, unknownKey, wholeNumber, type Parsed } from './args';
import type { Impl, ToolModule } from './modules';
import { sectionLinks, sections } from './read';
import { viewOf, type Row, type View } from './view';
import {
	askTimeline,
	PIECE_MS,
	timelineDir,
	timelinesOf,
	touchTimeline,
	videoKey,
	type Timeline
} from '../ai-timelines/store';
import { readPiece } from '../ai-timelines/files';
import { workerStatus } from '../worker-seen';

const MAX_FRAMES = 30;
const FRAME_MS = 2000;
const SOUND_MAX_MS = 60_000;
const MAX_VIDEOS = 200;
const MAX_EXAMPLES = 15;
const MISSING = 'No video with that id. Videos come from the videos tool.';

const ok = (data: unknown, extra: Partial<ToolResult> = {}): ToolResult => ({
	isError: false,
	text: JSON.stringify(data),
	...extra
});
const no = (text: string): ToolResult => ({ isError: true, text });
/** A phone-only video (offline phase 4c): no file on the server to read. */
const onDevice = (row: Row): boolean => row.server_copy === 0 || row.server_copy === false;

/** A video row the person may read; a recording only when it has a picture. */
function videoRow(v: View, video: SpotOwner): Row | undefined {
	if ('lessonVideoId' in video) return v.byId('lesson_videos', video.lessonVideoId);
	const rec = v.byId('recordings', video.recordingId);
	return rec && rec.kind === 'video' ? rec : undefined;
}

function titleOf(v: View, video: SpotOwner, row: Row): string {
	if ('recordingId' in video) return v.label(row.figure_id);
	const lesson = v.byId('lessons', row.lesson_id);
	const siblings = v
		.where('lesson_videos', 'lesson_id', row.lesson_id)
		.sort((a, b) => Number(a.id) - Number(b.id));
	const title = String(lesson?.title ?? '');
	return siblings.length > 1
		? `${title} · video ${siblings.findIndex((s) => s.id === row.id) + 1}`
		: title;
}

/** Whose a video is: its lesson's or its figure's owner. */
function ownerOf(v: View, video: SpotOwner, row: Row) {
	const root =
		'lessonVideoId' in video ? v.byId('lessons', row.lesson_id) : v.byId('figures', row.figure_id);
	return root ? v.owner(root) : 'mine';
}

const stateOf = (t: Timeline | undefined) =>
	!t
		? 'not prepared'
		: t.status === 'queued'
			? 'preparing'
			: t.status === 'ready'
				? 'ready'
				: 'failed';

const seconds = (ms: number) => Math.round(ms / 100) / 10;

type TimelineArgs = {
	video: SpotOwner;
	fromMs: number;
	toMs: number | null;
	everyMs: number;
	sound: boolean;
	blind: boolean;
};

function parseTimeline(a: Record<string, unknown>): Parsed<TimelineArgs> {
	const extra = unknownKey(
		a,
		['lesson_video_id', 'recording_id', 'from_s', 'to_s', 'every_s', 'sound', 'blind'],
		'video_timeline',
		'lesson_video_id or recording_id, from_s, to_s, every_s, sound and blind'
	);
	if (extra) return refuse(extra);
	const lv = wholeNumber(a.lesson_video_id, 1, Number.MAX_SAFE_INTEGER);
	const rec = wholeNumber(a.recording_id, 1, Number.MAX_SAFE_INTEGER);
	if ((lv === null) === (rec === null))
		return refuse(
			'Give exactly one of lesson_video_id and recording_id. ' + MISSING.split('. ')[1]
		);
	const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : null);
	const from = a.from_s === undefined ? 0 : num(a.from_s);
	const to = a.to_s === undefined ? null : num(a.to_s);
	if (from === null || (a.to_s !== undefined && (to === null || to <= from)))
		return refuse('from_s and to_s are seconds from the start, to_s after from_s.');
	const every = a.every_s === undefined ? 2 : wholeNumber(a.every_s, 2, 30);
	if (every === null || every % 2 !== 0)
		return refuse('every_s must be an even whole number from 2 to 30 (frames are 2 s apart).');
	const flag = (x: unknown) => (x === undefined ? false : typeof x === 'boolean' ? x : null);
	const sound = flag(a.sound);
	const blind = flag(a.blind);
	if (sound === null || blind === null) return refuse('sound and blind are true or false.');
	return {
		ok: true,
		args: {
			video: lv !== null ? { lessonVideoId: lv } : { recordingId: rec! },
			fromMs: Math.round(from * 1000),
			toMs: to === null ? null : Math.round(to * 1000),
			everyMs: every * 1000,
			sound,
			blind
		}
	};
}

/** The person's own sections (spans) on other videos: how they mark, newest first. */
function yourSections(v: View, video: SpotOwner) {
	const here = (s: Row) =>
		'lessonVideoId' in video
			? s.lesson_video_id === video.lessonVideoId
			: s.recording_id === video.recordingId;
	return v
		.rows('video_spots')
		.filter((s) => s.end_ms !== null && !here(s))
		.filter((s) => {
			const owner: SpotOwner =
				s.lesson_video_id !== null
					? { lessonVideoId: Number(s.lesson_video_id) }
					: { recordingId: Number(s.recording_id) };
			const row = videoRow(v, owner);
			return !!row && ownerOf(v, owner, row) === 'mine';
		})
		.sort((a, b) => Number(b.id) - Number(a.id))
		.slice(0, MAX_EXAMPLES)
		.map((s) => ({
			start_ms: s.start_ms,
			end_ms: s.end_ms,
			label: s.label,
			links: sectionLinks(v, s.id)
		}));
}

const TIMELINE_DESC =
	'Look at a lesson video or a video recording: small frames every 2 s (images, in order, one per frames_s) and, with sound: true, the sound as audio (try it once; if your app cannot take audio, leave it off and work from the frames). At most 30 frames a call: from_s to to_s (default 60 s), every_s to skim a long video (6 or 10), then look closer. The first call on a video has it prepared on the person`s home computer: you get "preparing"; ask again in a minute or two, and tell the person. sections_here are the sections already on this video (blind: true leaves them out, for measuring). your_sections are the person`s own sections on other videos: their habit is to start a section a little before the figure and end it a little after; sometimes earlier, to include the explanation. Propose sections with propose (add_section), and a figure for each with link_section; put one video`s sections in one action.';

const DEFS: ToolDef[] = [
	{
		name: 'videos',
		title: 'Videos',
		description:
			'The person`s lesson videos and video recordings, newest first, with how many sections each has and whether it is ready to look at (ready, preparing, failed, not prepared). worker says whether the home computer that prepares videos is online.',
		inputSchema: { type: 'object', properties: {}, additionalProperties: false },
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false
		}
	},
	{
		name: 'video_timeline',
		title: 'Look at a video',
		description: TIMELINE_DESC,
		inputSchema: {
			type: 'object',
			properties: {
				lesson_video_id: { type: 'integer' },
				recording_id: { type: 'integer' },
				from_s: { type: 'number', minimum: 0 },
				to_s: { type: 'number' },
				every_s: { type: 'integer', minimum: 2, maximum: 30 },
				sound: { type: 'boolean' },
				blind: { type: 'boolean' }
			},
			additionalProperties: false
		},
		// It queues the video's preparation on the first look: not read-only, nothing destroyed.
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false
		}
	}
];

const videosImpl: Impl = async (args, ctx) => {
	const extra = unknownKey(args, [], 'videos', 'no arguments');
	if (extra) return no(extra);
	const v = viewOf(ctx.db, ctx.userId);
	const all: { video: SpotOwner; row: Row }[] = [
		...v.rows('lesson_videos').map((row) => ({
			video: { lessonVideoId: Number(row.id) } as SpotOwner,
			row
		})),
		...v
			.rows('recordings')
			.filter((r) => r.kind === 'video')
			.map((row) => ({ video: { recordingId: Number(row.id) } as SpotOwner, row }))
	].sort((a, b) => Number(b.row.created_at) - Number(a.row.created_at));
	const shown = all.slice(0, MAX_VIDEOS);
	const timelines = timelinesOf(
		ctx.db,
		shown.map((s) => s.video)
	);
	return ok({
		worker: workerStatus(ctx.now),
		total: all.length,
		videos: shown.map(({ video, row }) => {
			const t = timelines.get(videoKey(video));
			const column = 'lessonVideoId' in video ? 'lesson_video_id' : 'recording_id';
			return {
				[column]: row.id,
				title: titleOf(v, video, row),
				...(onDevice(row) ? { on_device: true } : {}),
				owner: ownerOf(v, video, row),
				sections: v.where('video_spots', column, row.id).filter((s) => s.end_ms !== null).length,
				timeline: stateOf(t),
				...(t?.status === 'ready' && t.durationMs !== null
					? { duration_s: seconds(t.durationMs) }
					: {})
			};
		})
	});
};

const timelineImpl: Impl = async (args, ctx) => {
	const p = parseTimeline(args);
	if (!p.ok) return no(p.message);
	const { video } = p.args;
	const v = viewOf(ctx.db, ctx.userId);
	const row = videoRow(v, video);
	if (!row) return no(MISSING);
	// Offline phase 4c: a phone-only video has no file here; nothing is queued.
	if (onDevice(row))
		return ok({
			status: 'on a device',
			device: deviceLabelFor(ctx.db, row.origin_slot === null ? null : Number(row.origin_slot)),
			message:
				'This video is only on one of the person’s devices and cannot be read until it is uploaded there. Tell the person.'
		});

	const t = askTimeline(ctx.db, video, ctx.now);
	if (t.status === 'failed')
		return ok({
			status: 'failed',
			error: t.error,
			message: 'Tell the person; it is tried again a day later.'
		});
	if (t.status === 'queued') {
		return workerStatus(ctx.now) === 'offline'
			? ok({
					status: 'worker offline',
					message:
						'The home worker has not been seen for over 15 minutes; this video will be prepared when it is back. Tell the person.'
				})
			: ok({
					status: 'preparing',
					message:
						'Being prepared on the home worker; ask again in a minute or two. Tell the person.'
				});
	}

	const duration = t.durationMs ?? 0;
	const { fromMs, everyMs, sound } = p.args;
	if (fromMs >= duration) return no(`The video is ${seconds(duration)} s long.`);
	const toMs = Math.min(p.args.toMs ?? fromMs + 60_000, duration);
	if (Math.ceil((toMs - fromMs) / everyMs) > MAX_FRAMES)
		return no('At most 30 frames a call: shorten the stretch or raise every_s.');
	if (sound && toMs - fromMs > SOUND_MAX_MS) return no('With sound, at most 60 s a call.');

	const dir = timelineDir(t.id);
	const firstPiece = Math.floor(fromMs / PIECE_MS);
	const lastPiece = Math.floor((toMs - 1) / PIECE_MS);
	const frames: { tMs: number; data: string }[] = [];
	const audio: { fromMs: number; toMs: number; data: string }[] = [];
	for (let k = firstPiece; k <= lastPiece; k++) {
		const piece = await readPiece(dir, k);
		if (!piece) continue;
		frames.push(...piece.frames.filter((f) => f.tMs >= fromMs && f.tMs < toMs));
		if (sound && piece.sound)
			audio.push({
				fromMs: k * PIECE_MS,
				toMs: Math.min((k + 1) * PIECE_MS, duration),
				data: piece.sound
			});
	}
	const step = Math.max(1, Math.round(everyMs / FRAME_MS));
	const picked = frames.filter((_, i) => i % step === 0);
	touchTimeline(ctx.db, t.id, ctx.now);

	const column = 'lessonVideoId' in video ? 'lesson_video_id' : 'recording_id';
	return ok(
		{
			video: {
				[column]: row.id,
				title: titleOf(v, video, row),
				duration_s: seconds(duration)
			},
			from_s: seconds(fromMs),
			to_s: seconds(toMs),
			frames_s: picked.map((f) => seconds(f.tMs)),
			sound: !sound
				? 'off'
				: audio.length
					? audio.map((a) => ({ from_s: seconds(a.fromMs), to_s: seconds(a.toMs) }))
					: 'none on this video',
			next_from_s: toMs < duration ? seconds(toMs) : null,
			...(p.args.blind ? {} : { sections_here: sections(v, column, row.id) }),
			your_sections: yourSections(v, video)
		},
		{
			images: picked.map((f) => ({ data: f.data, mimeType: 'image/jpeg' })),
			audio: audio.map((a) => ({ data: a.data, mimeType: 'audio/mpeg' }))
		}
	);
};

export const videoTools: ToolModule = {
	defs: DEFS,
	impls: { videos: videosImpl, video_timeline: timelineImpl }
};
