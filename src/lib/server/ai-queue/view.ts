/**
 * The Suggestions page's data: every card built by the app from the change
 * itself (what it touches, the words it strikes and adds, who will see it),
 * in the reader's language. The AI's own title is shown too, but never alone.
 */
import { desc, inArray } from 'drizzle-orm';
import type { Db } from '../db';
import { oauthGrants } from '../db/schema';
import { viewOf, type View } from '../mcp/view';
import { clientHost } from '../oauth/register';
import { t } from '$lib/i18n/catalog';
import { agoText, clock } from '$lib/format';
import { wordDiff } from '$lib/ai-queue/diff';
import type { SuggestionAction, SuggestionLine, SuggestionsView } from '$lib/types';
import { KINDS, type Refusal } from './kinds';
import './kinds/all';
import { queueOf, type QueueAction, type QueueLine } from './store';
export { pendingCount } from './store';
import { UNDO_MS } from './run';
import { madeId, type Made } from './refs';

type Row = Record<string, unknown>;
type Ref = number | { ref: number };

/** The AI app the newest suggestion came through: its own name, else its host. */
function whoSuggests(db: Db, actions: QueueAction[]): string {
	const ids = [...new Set(actions.map((a) => a.grantId).filter((g): g is number => g !== null))];
	if (!ids.length) return t().suggestions.theAi;
	const g = db
		.select()
		.from(oauthGrants)
		.where(inArray(oauthGrants.id, ids))
		.orderBy(desc(oauthGrants.lastUsedAt))
		.get();
	return g ? (g.clientName ?? clientHost(g.clientId, g.redirectUri)) : t().suggestions.theAi;
}

const ms = (v: unknown) => clock(Number(v) / 1000);

/** A refusal in the reader`s words. */
export function refusalText(r: Refusal | null): string | null {
	if (!r) return null;
	const w = t().suggestions;
	const a = r.args ?? {};
	switch (r.code) {
		case 'changed':
			return w.refusals.changed(
				String(a.fields ?? '')
					.split(', ')
					.map((f) => w.fields[f as keyof typeof w.fields] ?? f)
					.join(', ')
			);
		case 'nameTaken':
			return w.refusals.nameTaken(String(a.name ?? ''));
		case 'waits':
			return w.refusals.waits(Number(a.n));
		case 'dependsOn':
			return w.refusals.dependsOn(Number(a.n));
		case 'gone':
		case 'notCustom':
		case 'badSpan':
		case 'linked':
		case 'notGroup':
		case 'badSlot':
		case 'notArchived':
		case 'cannotLink':
		case 'claudeChanged':
		case 'noUndo':
		case 'tooLate':
			return w.refusals[r.code];
		default:
			return w.refusals.failed;
	}
}

/** Names of the things a card talks about, from the person's own view. */
function namer(v: View, numberOf: (actionId: number) => number, made: Map<number, Made>) {
	const w = t().suggestions;
	const TABLE = {
		move: 'figure_groups',
		figure: 'figures',
		routine: 'routines',
		drill: 'exercises',
		lesson: 'lessons',
		position: 'positions',
		section: 'video_spots'
	} as const;
	type Thing = keyof typeof TABLE;
	const nameOfRow = (thing: Thing, r: Row): string => {
		if (thing === 'figure') return v.label(r.id);
		if (thing === 'lesson') return String(r.title ?? '');
		if (thing === 'section')
			return String(r.label ?? '') || `${ms(r.start_ms)}–${r.end_ms === null ? '' : ms(r.end_ms)}`;
		return String(r.name ?? '');
	};
	const resolve = (id: Ref, thing?: string): number | null => {
		if (typeof id === 'number') return id;
		const m = made.get(id.ref);
		return m ? madeId(m, thing === 'move' ? 'move' : null) : null;
	};
	return {
		row: (thing: Thing, id: Ref) => {
			const n = resolve(id, thing);
			return n === null ? undefined : v.byId(TABLE[thing], n);
		},
		name(thing: Thing, id: Ref): string {
			const n = resolve(id, thing);
			const r = n === null ? undefined : v.byId(TABLE[thing], n);
			if (r) return nameOfRow(thing, r);
			return typeof id === 'number' ? `#${id}` : w.madeBy(numberOf(id.ref));
		},
		/** "X will see this" when the row is a group's. */
		where(thing: Thing, id: Ref): string | null {
			const r = this.row(thing, id);
			const o = r ? v.owner(r) : 'mine';
			return o === 'mine' ? null : w.groupSees(o.group);
		},
		groupWhere(groupId: unknown): string | null {
			if (typeof groupId !== 'number') return null;
			const team = v.byId('teams', groupId);
			return team ? w.groupSees(String(team.name)) : null;
		}
	};
}

const EDITS: Record<
	string,
	{ thing: 'move' | 'figure' | 'routine' | 'drill' | 'lesson' | 'position' | 'section' }
> = {
	rename_move: { thing: 'move' },
	edit_figure: { thing: 'figure' },
	edit_routine: { thing: 'routine' },
	edit_drill: { thing: 'drill' },
	edit_lesson: { thing: 'lesson' },
	edit_position: { thing: 'position' },
	edit_section: { thing: 'section' }
};

function lineView(
	v: View,
	names: ReturnType<typeof namer>,
	line: QueueLine,
	now: number
): SuggestionLine {
	const w = t().suggestions;
	const p = line.payload as Record<string, unknown>;
	const out: SuggestionLine = {
		id: line.id,
		status: line.status,
		heading: w.heading.unknown,
		where: null,
		fields: [],
		section: null,
		warning: null,
		refusal: line.status === 'pending' ? refusalText(line.refusal) : null,
		canUndo:
			line.status === 'done' && !!KINDS[line.kind]?.undo && now - (line.ranAt ?? 0) <= UNDO_MS
	};
	const fmt = (key: string, value: unknown) =>
		value === null || value === undefined ? '' : key.endsWith('_ms') ? ms(value) : String(value);
	const field = (key: string, before: unknown, after: unknown) =>
		out.fields.push({
			label: w.fields[key as keyof typeof w.fields] ?? key,
			parts: wordDiff(fmt(key, before), fmt(key, after))
		});
	const edit = EDITS[line.kind];
	if (edit) {
		const id = p.id as number;
		out.heading = w.heading[line.kind as 'rename_move'](names.name(edit.thing, id));
		out.where = names.where(edit.thing, id);
		const set = (p.set ?? {}) as Record<string, unknown>;
		const before = ((line.status === 'done' ? line.result?.before : line.before) ?? {}) as Record<
			string,
			unknown
		>;
		for (const k of Object.keys(set)) field(k, before[k], set[k]);
		if (line.kind === 'edit_section') {
			const r = names.row('section', id);
			const src = r ? videoSrc(v, r) : null;
			if (src && r)
				out.section = {
					src,
					startMs: Number(set.start_ms ?? r.start_ms),
					endMs: Number(set.end_ms ?? r.end_ms ?? r.start_ms)
				};
		}
		return out;
	}
	switch (line.kind) {
		case 'add_section': {
			const video = p.video as { lessonVideoId?: number; recordingId?: number };
			const owner = video.lessonVideoId
				? v.byId('lesson_videos', video.lessonVideoId)
				: v.byId('recordings', video.recordingId);
			const where = owner
				? video.lessonVideoId
					? String(v.byId('lessons', owner.lesson_id)?.title ?? '')
					: v.label(owner.figure_id)
				: '';
			out.heading = w.heading.add_section(ms(p.startMs), ms(p.endMs), where);
			out.where = video.lessonVideoId
				? names.where('lesson', (owner?.lesson_id as number) ?? 0)
				: names.where('figure', (owner?.figure_id as number) ?? 0);
			if (p.label) field('label', null, p.label);
			if (owner)
				out.section = {
					src: `/${video.lessonVideoId ? 'lesson-videos' : 'recordings'}/${owner.file}`,
					startMs: Number(p.startMs),
					endMs: Number(p.endMs)
				};
			return out;
		}
		case 'link_section': {
			const target = p.target as { figure?: Ref; drill?: Ref };
			out.heading = w.heading.link_section(
				names.name('section', p.section as Ref),
				target.figure !== undefined
					? names.name('figure', target.figure)
					: names.name('drill', target.drill!)
			);
			out.where = names.where('section', p.section as Ref);
			return out;
		}
		case 'link_lesson': {
			const thing = (
				{
					figure_id: 'figure',
					routine_id: 'routine',
					drill_id: 'drill',
					position_id: 'position'
				} as const
			)[p.key as 'figure_id'];
			out.heading = w.heading.link_lesson(
				w.things[thing],
				names.name(thing, p.target as Ref),
				names.name('lesson', p.lesson as Ref)
			);
			out.where = names.where('lesson', p.lesson as Ref);
			return out;
		}
		case 'publish_lesson':
			out.heading = w.heading.publish_lesson(names.name('lesson', p.id as number));
			out.where = names.where('lesson', p.id as number);
			out.warning = w.publishWarning;
			return out;
		case 'create_figure': {
			const move = p.move === null ? String(p.moveName) : names.name('move', p.move as Ref);
			out.heading = w.heading.create_figure(`${move} · ${p.name}`);
			out.where =
				p.move === null ? names.groupWhere(p.groupId) : names.where('move', p.move as Ref);
			if (p.notes) field('notes', null, p.notes);
			return out;
		}
		case 'create_drill':
		case 'create_position':
		case 'create_routine':
			out.heading = w.heading[line.kind](String(p.name));
			out.where = names.groupWhere(p.groupId);
			if (p.notes) field('notes', null, p.notes);
			if (line.kind === 'create_routine' && Array.isArray(p.slots) && p.slots.length)
				field('slots', null, (p.slots as Ref[]).map((s) => names.name('figure', s)).join(', '));
			return out;
		case 'create_lesson':
			out.heading = w.heading.create_lesson(String(p.title));
			out.where = names.groupWhere(p.groupId);
			if (p.notes) field('notes', null, p.notes);
			return out;
		case 'archive':
		case 'restore': {
			const thing = p.thing as 'figure' | 'routine' | 'drill' | 'lesson' | 'position';
			out.heading = w.heading[line.kind](w.things[thing], names.name(thing, p.id as number));
			out.where = names.where(thing, p.id as number);
			return out;
		}
	}
	return out;
}

/** A section's video, served for the preview. */
function videoSrc(v: View, spot: Row): string | null {
	if (spot.lesson_video_id !== null) {
		const video = v.byId('lesson_videos', spot.lesson_video_id);
		return video ? `/lesson-videos/${video.file}` : null;
	}
	const rec = v.byId('recordings', spot.recording_id);
	return rec ? `/recordings/${rec.file}` : null;
}

function stateOf(a: QueueAction): SuggestionAction['state'] {
	const work = a.lines.filter((l) => l.status !== 'left_out');
	if (work.length && work.every((l) => l.status === 'done' || l.status === 'undone')) return 'done';
	if (work.length && work.every((l) => l.status === 'dropped')) return 'dropped';
	if (work.some((l) => l.status === 'done')) return 'partly';
	return 'pending';
}

export function suggestionsView(
	db: Db,
	userId: string,
	dance: string,
	now: number
): SuggestionsView {
	const groups = queueOf(db, userId, dance, now);
	const actions = groups.flatMap((g) => g.actions);
	const byId = new Map(actions.map((a) => [a.id, a]));
	const made = new Map<number, Made>();
	for (const a of actions) {
		const r = a.lines.find((l) => l.status === 'done' && typeof l.result?.id === 'number');
		if (r)
			made.set(a.id, {
				id: r.result!.id as number,
				...(typeof r.result!.moveId === 'number' ? { moveId: r.result!.moveId } : {})
			});
	}
	const v = viewOf(db, userId);
	const names = namer(v, (id) => byId.get(id)?.n ?? 0, made);
	const who = whoSuggests(db, actions);
	const isDone = (a: QueueAction | undefined) => !!a && stateOf(a) === 'done';
	return {
		who,
		waiting: actions.filter((a) => a.lines.some((l) => l.status === 'pending')).length,
		groups: groups.map((g) => ({
			id: g.id,
			title: g.title,
			pending: g.actions
				.filter((a) => a.lines.some((l) => l.status === 'pending'))
				.map((a) => a.id),
			actions: g.actions.map((a) => ({
				id: a.id,
				n: a.n,
				title: a.title,
				version: a.version,
				changed:
					a.version > 1 && a.previous
						? {
								line: t().suggestions.changedBy(who, agoText(a.updatedAt, now)),
								previousTitle: a.previous.title
							}
						: null,
				state: stateOf(a),
				waitsFor: a.needs
					.map((id) => byId.get(id))
					.filter((n) => n && !isDone(n))
					.map((n) => n!.n),
				lines: a.lines.map((l) => lineView(v, names, l, now))
			}))
		}))
	};
}
