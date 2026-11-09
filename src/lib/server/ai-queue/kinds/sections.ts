/**
 * Sections on videos: add one (a lesson video's or a recording's), and link a
 * section to a figure or a drill. Through `addSpot` and `linkSpot`, as the
 * video player's own calls; Undo removes them the way the player does.
 */
import { eq } from 'drizzle-orm';
import type { Db } from '../../db';
import { exercises, figures } from '../../db/schema';
import { addSpot, deleteSpot, SpotError } from '../../spots';
import { linkSpot, SpotLinkedError, SpotLinkError, unlinkFromSection } from '../../spot-links';
import { allows, judgeDrill, judgeFigure, judgeVideo } from '../../access';
import { videoRoot } from '../../changes';
import { rootOfRecording, rootOfSpot, rootOfVideo } from '../../clones/flow-hook';
import type { SpotOwner } from '$lib/types';
import { refuse, unknownKey, wholeNumber } from '../../mcp/args';
import { editable } from '../reach';
import { idOrRef, isRef, resolved, type IdOrRef } from './ids';
import { registerKinds, type LineKind, type Who } from '.';
import { NAME_MAX } from './edit';

const MAX_MS = 24 * 3600_000;

type AddSection = { video: SpotOwner; startMs: number; endMs: number; label: string | null };

function videoEditable(db: Db, who: Who, owner: SpotOwner): boolean {
	const root = videoRoot(db, owner);
	if (!root || (root.row as { dance?: string }).dance !== who.dance) return false;
	return allows(judgeVideo(db, who.userId, owner).access, 'edit');
}

const addSection: LineKind<AddSection> = {
	kind: 'add_section',
	shape: '{ lesson_video_id | recording_id, start_ms, end_ms, label? }',
	parse(raw) {
		const extra = unknownKey(
			raw,
			['lesson_video_id', 'recording_id', 'start_ms', 'end_ms', 'label'],
			'add_section',
			'lesson_video_id or recording_id, start_ms, end_ms and label'
		);
		if (extra) return refuse(extra);
		const lv = wholeNumber(raw.lesson_video_id, 1, Number.MAX_SAFE_INTEGER);
		const rec = wholeNumber(raw.recording_id, 1, Number.MAX_SAFE_INTEGER);
		if ((lv === null) === (rec === null))
			return refuse(
				'Give exactly one of lesson_video_id and recording_id. Videos come from get_lesson or get_figure.'
			);
		const startMs = wholeNumber(raw.start_ms, 0, MAX_MS);
		const endMs = wholeNumber(raw.end_ms, 1, MAX_MS);
		if (startMs === null || endMs === null || endMs <= startMs)
			return refuse('start_ms and end_ms must be whole milliseconds, end after start.');
		const label = raw.label;
		if (
			label !== undefined &&
			label !== null &&
			(typeof label !== 'string' || label.length > NAME_MAX)
		)
			return refuse(`label must be text of at most ${NAME_MAX} characters.`);
		return {
			ok: true,
			args: {
				video: lv !== null ? { lessonVideoId: lv } : { recordingId: rec! },
				startMs,
				endMs,
				label: typeof label === 'string' && label.trim() ? label.trim() : null
			}
		};
	},
	prepare(db, who, p) {
		return videoEditable(db, who, p.video)
			? { ok: true, before: null }
			: { ok: false, message: 'No video with that id that you can edit.' };
	},
	run(db, who, p) {
		if (!videoEditable(db, who, p.video)) return { ok: false, refusal: { code: 'gone' } };
		try {
			const spot = addSpot(
				db,
				p.video,
				{ startMs: p.startMs, endMs: p.endMs, label: p.label },
				who.userId
			);
			return spot
				? { ok: true, result: { id: spot.id } }
				: { ok: false, refusal: { code: 'gone' } };
		} catch (e) {
			if (e instanceof SpotError) return { ok: false, refusal: { code: 'badSpan' } };
			throw e;
		}
	},
	undo(db, who, _p, result, now) {
		const id = Number(result.id);
		if (!editable(db, who.userId, who.dance, 'section', id))
			return { ok: false, refusal: { code: 'gone' } };
		try {
			return deleteSpot(db, id, who.userId, now)
				? { ok: true }
				: { ok: false, refusal: { code: 'gone' } };
		} catch (e) {
			if (e instanceof SpotLinkedError) return { ok: false, refusal: { code: 'linked' } };
			throw e;
		}
	},
	flows: (db, p) =>
		'lessonVideoId' in p.video
			? rootOfVideo(db, p.video.lessonVideoId)
			: rootOfRecording(db, p.video.recordingId)
};

type LinkSection = { section: IdOrRef; target: { figure: IdOrRef } | { drill: IdOrRef } };

/** A target the person may at least read (the link itself decides the rest). */
function targetReadable(db: Db, who: Who, t: LinkSection['target']): boolean {
	if ('figure' in t) {
		if (isRef(t.figure)) return true;
		const row = db.select().from(figures).where(eq(figures.id, t.figure)).get();
		return (
			!!row && row.dance === who.dance && allows(judgeFigure(db, who.userId, row).access, 'read')
		);
	}
	if (isRef(t.drill)) return true;
	const row = db.select().from(exercises).where(eq(exercises.id, t.drill)).get();
	return !!row && row.dance === who.dance && allows(judgeDrill(db, who.userId, row).access, 'read');
}

const linkSection: LineKind<LinkSection> = {
	kind: 'link_section',
	shape: '{ section_id, figure_id | drill_id } (each may be {"ref": <action id>})',
	parse(raw) {
		const extra = unknownKey(
			raw,
			['section_id', 'figure_id', 'drill_id'],
			'link_section',
			'section_id and figure_id or drill_id'
		);
		if (extra) return refuse(extra);
		const section = idOrRef(raw.section_id, 'section_id');
		if (!section.ok) return section;
		if ((raw.figure_id === undefined) === (raw.drill_id === undefined))
			return refuse('Give exactly one of figure_id and drill_id.');
		const t = idOrRef(
			raw.figure_id ?? raw.drill_id,
			raw.figure_id !== undefined ? 'figure_id' : 'drill_id'
		);
		if (!t.ok) return t;
		return {
			ok: true,
			args: {
				section: section.args,
				target: raw.figure_id !== undefined ? { figure: t.args } : { drill: t.args }
			}
		};
	},
	prepare(db, who, p) {
		if (!isRef(p.section) && !editable(db, who.userId, who.dance, 'section', p.section))
			return { ok: false, message: `No section with id ${p.section} that you can edit.` };
		if (!targetReadable(db, who, p.target))
			return {
				ok: false,
				message: 'No figure or drill with that id. Ids come from search or list.'
			};
		return { ok: true, before: null };
	},
	run(db, who, p) {
		const spotId = resolved(p.section);
		const target =
			'figure' in p.target
				? { figureId: resolved(p.target.figure) }
				: { exerciseId: resolved(p.target.drill) };
		try {
			return { ok: true, result: { id: linkSpot(db, who.userId, spotId, target), spotId } };
		} catch (e) {
			if (e instanceof SpotLinkError) return { ok: false, refusal: { code: 'cannotLink' } };
			throw e;
		}
	},
	undo(db, who, _p, result, now) {
		return unlinkFromSection(db, Number(result.spotId), Number(result.id), false, now, who.userId)
			? { ok: true }
			: { ok: false, refusal: { code: 'gone' } };
	},
	flows: (db, p) => rootOfSpot(db, resolved(p.section))
};

registerKinds(addSection as never, linkSection as never);
