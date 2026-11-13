/**
 * The connector's read tools (plan 1 of the AI connector). Everything comes
 * from `viewOf`: the rows the person's phone may hold, so a tool cannot read
 * past what the person may read. A missing id and an id the person may not
 * read answer the same words. Results are compact JSON for the AI; names and
 * notes are the person's own words, never translated.
 */
import { hearingOf } from '$lib/hearing/drill';
import type { ToolDef, ToolResult } from '$lib/mcp/protocol';
import {
	FIND_IDS,
	KINDS,
	LIST_KINDS,
	parseId,
	parseList,
	parseNone,
	parseSearch,
	type Kind,
	type Parsed
} from './args';
import type { Impl, ToolCtx, ToolModule } from './modules';
import { viewOf, type Row, type View } from './view';
import { countsOfMask } from '$lib/graph/timing';

const TABLE: Record<Kind, string> = {
	move: 'figure_groups',
	figure: 'figures',
	routine: 'routines',
	drill: 'exercises',
	lesson: 'lessons',
	position: 'positions',
	section: 'video_spots'
};

/** At most this many items in one answer; `total` says how many there were. */
const MAX_ITEMS = 200;
const SEARCH_MAX = 50;

const READ = {
	readOnlyHint: true,
	destructiveHint: false,
	idempotentHint: true,
	openWorldHint: false
} as const;

const ok = (data: unknown): ToolResult => ({ isError: false, text: JSON.stringify(data) });
const no = (text: string): ToolResult => ({ isError: true, text });
const missing = (kind: Kind, id: number) => no(`No ${kind} with id ${id}. ${FIND_IDS}`);

const archivedRow = (r: Row) => r.archived_at !== null && r.archived_at !== undefined;
/** A person's entry of a group drill is theirs to log, not a drill of its own. */
const isDrill = (r: Row) => r.drill_id === null || r.drill_id === undefined;

/** Case- and accent-insensitive text for matching. */
const fold = (s: unknown) =>
	String(s ?? '')
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase();

function rowsOf(v: View, kind: Kind): Row[] {
	const rows = v.rows(TABLE[kind]);
	if (kind === 'drill') return rows.filter(isDrill);
	if (kind === 'section') return rows.filter((r) => r.end_ms !== null);
	return rows;
}

function byIdOf(v: View, kind: Kind, id: number): Row | undefined {
	const r = v.byId(TABLE[kind], id);
	if (!r) return undefined;
	if (kind === 'drill' && !isDrill(r)) return undefined;
	return r;
}

function nameOf(v: View, kind: Kind, r: Row): string {
	if (kind === 'lesson') return String(r.title ?? '');
	if (kind === 'figure') return v.label(r.id);
	if (kind === 'section') return String(r.label ?? '');
	return String(r.name ?? '');
}

/** A section's owner is its video's: a lesson's, or a recording's figure's. */
function ownerRow(v: View, kind: Kind, r: Row): Row | undefined {
	if (kind !== 'section') return r;
	if (r.lesson_video_id !== null) {
		const video = v.byId('lesson_videos', r.lesson_video_id);
		return video && v.byId('lessons', video.lesson_id);
	}
	const rec = v.byId('recordings', r.recording_id);
	return rec && v.byId('figures', rec.figure_id);
}

function item(v: View, kind: Kind, r: Row) {
	const owner = ownerRow(v, kind, r);
	return {
		id: r.id,
		kind,
		name: nameOf(v, kind, r),
		owner: owner ? v.owner(owner) : 'mine',
		...(archivedRow(r) ? { archived: true } : {})
	};
}

const newestFirst = (a: Row, b: Row) =>
	Number(b.created_at ?? 0) - Number(a.created_at ?? 0) || Number(b.id) - Number(a.id);

const capped = <T>(all: T[], max = MAX_ITEMS) => ({
	total: all.length,
	items: all.slice(0, max)
});

/* ── Details ─────────────────────────────────────────────────────────────── */

const positionNames = (v: View, table: string, figureId: unknown) =>
	v
		.where(table, 'figure_id', figureId)
		.map((l) => v.byId('positions', l.position_id))
		.filter((p): p is Row => !!p)
		.map((p) => String(p.name));

/** What a section links to, by name. */
export function sectionLinks(v: View, spotId: unknown) {
	return v.where('spot_links', 'spot_id', spotId).map((l) =>
		l.figure_id !== null
			? { figure: v.label(l.figure_id), figure_id: l.figure_id }
			: {
					drill: String(v.byId('exercises', l.exercise_id)?.name ?? ''),
					drill_id: l.exercise_id
				}
	);
}

export function sections(v: View, column: 'recording_id' | 'lesson_video_id', id: unknown) {
	return v
		.where('video_spots', column, id)
		.sort((a, b) => Number(a.start_ms) - Number(b.start_ms))
		.map((s) => ({
			id: s.id,
			label: s.label,
			start_ms: s.start_ms,
			end_ms: s.end_ms,
			...(s.end_ms === null ? { point: true } : {}),
			links: sectionLinks(v, s.id)
		}));
}

function figureDetail(v: View, f: Row) {
	return {
		id: f.id,
		label: v.label(f.id),
		name: f.name,
		start_count: f.start_count,
		length_counts: f.length_counts,
		// Spec 2026-11-11: only when set, so an untouched figure reads as before.
		...(f.start_counts
			? {
					start_counts: countsOfMask(
						Number(f.start_counts),
						f.start_count === null ? null : Number(f.start_count)
					)
				}
			: {}),
		...(f.length_free ? { length_set_in_routine: true } : {}),
		starts: positionNames(v, 'figure_start_positions', f.id),
		ends: positionNames(v, 'figure_end_positions', f.id),
		notes: f.notes,
		...(archivedRow(f) ? { archived: true } : {}),
		recordings: v.where('recordings', 'figure_id', f.id).map((r) => ({
			id: r.id,
			note: r.note,
			sections: sections(v, 'recording_id', r.id)
		}))
	};
}

const nameList = (v: View, kind: Kind, ids: unknown[]) =>
	[...new Set(ids)]
		.map((id) => (typeof id === 'number' ? byIdOf(v, kind, id) : undefined))
		.filter((r): r is Row => !!r)
		.map((r) => ({ id: r.id, name: nameOf(v, kind, r) }));

/* ── The tools ───────────────────────────────────────────────────────────── */

type Tool = { def: ToolDef; impl: Impl };

/** A tool whose arguments are parsed first; a refusal goes back to the AI as one line. */
function tool<A>(
	def: Omit<ToolDef, 'annotations'>,
	parse: (a: Record<string, unknown>) => Parsed<A>,
	run: (args: A, v: View, ctx: ToolCtx) => ToolResult
): Tool {
	return {
		def: { ...def, annotations: READ },
		impl: async (raw, ctx) => {
			const p = parse(raw);
			if (!p.ok) return no(p.message);
			return run(p.args, viewOf(ctx.db, ctx.userId), ctx);
		}
	};
}

const idSchema = {
	type: 'object',
	properties: { id: { type: 'integer', minimum: 1 } },
	required: ['id'],
	additionalProperties: false
};

const getOne = (
	kind: Kind,
	title: string,
	description: string,
	detail: (v: View, r: Row) => unknown
) =>
	tool(
		{ name: `get_${kind}`, title, description, inputSchema: idSchema },
		(a) => parseId(a, `get_${kind}`),
		({ id }, v) => {
			const r = byIdOf(v, kind, id);
			return r ? ok(detail(v, r)) : missing(kind, id);
		}
	);

const TOOLS: Tool[] = [
	tool(
		{
			name: 'search',
			title: 'Search',
			description: `Find moves, figures, routines, drills, lessons, positions and video sections by name (case and accents ignored), then by notes. Up to ${SEARCH_MAX} results, names first.`,
			inputSchema: {
				type: 'object',
				properties: {
					query: { type: 'string', minLength: 1, maxLength: 100 },
					kinds: { type: 'array', items: { type: 'string', enum: [...KINDS] } },
					include_archived: { type: 'boolean' }
				},
				required: ['query'],
				additionalProperties: false
			}
		},
		parseSearch,
		({ query, kinds, includeArchived }, v) => {
			const q = fold(query);
			const byName: ReturnType<typeof item>[] = [];
			const byNotes: ReturnType<typeof item>[] = [];
			for (const kind of kinds) {
				for (const r of rowsOf(v, kind)) {
					if (!includeArchived && archivedRow(r)) continue;
					if (fold(nameOf(v, kind, r)).includes(q)) byName.push(item(v, kind, r));
					else if (fold(r.notes).includes(q)) byNotes.push(item(v, kind, r));
				}
			}
			return ok(capped([...byName, ...byNotes], SEARCH_MAX));
		}
	),
	tool(
		{
			name: 'list',
			title: 'List',
			description: `Every item of one kind (${LIST_KINDS.join(', ')}), newest first, optionally only one group's (group_id from list_groups). Up to ${MAX_ITEMS}; total says how many there are.`,
			inputSchema: {
				type: 'object',
				properties: {
					kind: { type: 'string', enum: [...LIST_KINDS] },
					group_id: { type: 'integer', minimum: 1 },
					include_archived: { type: 'boolean' }
				},
				required: ['kind'],
				additionalProperties: false
			}
		},
		parseList,
		({ kind, groupId, includeArchived }, v) =>
			ok(
				capped(
					rowsOf(v, kind)
						.filter((r) => includeArchived || !archivedRow(r))
						.filter((r) => groupId === null || r.team_id === groupId)
						.sort(newestFirst)
						.map((r) => item(v, kind, r))
				)
			)
	),
	getOne(
		'move',
		'Get a move',
		'A move and its figures: each figure`s timing (start count, length in counts), start and end positions, notes, and recordings with their sections (ms).',
		(v, m) => ({
			...item(v, 'move', m),
			figures: v.where('figures', 'group_id', m.id).map((f) => figureDetail(v, f))
		})
	),
	getOne(
		'figure',
		'Get a figure',
		'One figure as in get_move, with its move, and the routines and lessons that use it.',
		(v, f) => {
			const steps = v.where('routine_steps', 'figure_id', f.id);
			const alternatives = v
				.where('routine_step_options', 'figure_id', f.id)
				.map((o) => v.byId('routine_steps', o.step_id))
				.filter((s): s is Row => !!s);
			return {
				...figureDetail(v, f),
				owner: v.owner(f),
				move: { id: f.group_id, name: v.byId('figure_groups', f.group_id)?.name ?? null },
				routines: nameList(
					v,
					'routine',
					[...steps, ...alternatives].map((s) => s.routine_id)
				),
				lessons: nameList(
					v,
					'lesson',
					v.where('lesson_figures', 'figure_id', f.id).map((l) => l.lesson_id)
				)
			};
		}
	),
	getOne(
		'routine',
		'Get a routine',
		'A routine`s slots in order: each slot`s figure (or embedded routine), its alternatives and note; and the routine`s notes.',
		(v, r) => ({
			...item(v, 'routine', r),
			notes: r.notes,
			slots: v
				.where('routine_steps', 'routine_id', r.id)
				.sort((a, b) => Number(a.position) - Number(b.position))
				.map((s) => ({
					id: s.id,
					...(s.figure_id !== null
						? { figure: v.label(s.figure_id), figure_id: s.figure_id }
						: {
								routine: String(v.byId('routines', s.child_routine_id)?.name ?? ''),
								routine_id: s.child_routine_id
							}),
					alternatives: v.where('routine_step_options', 'step_id', s.id).map((o) => ({
						figure: v.label(o.figure_id),
						figure_id: o.figure_id,
						...(o.length_counts !== null && o.length_counts !== undefined
							? { length_counts: o.length_counts }
							: {})
					})),
					note: s.note
				}))
		})
	),
	getOne(
		'drill',
		'Get a drill',
		'A drill: notes, what it practises (a figure, a routine), how it comes back, its links, and the lessons it belongs to.',
		(v, d) => ({
			...item(v, 'drill', d),
			notes: d.notes,
			source: d.source,
			practice_mode: d.practice_mode,
			comes_back: d.comes_back,
			warmup: !!d.warmup,
			// A hearing drill (phase 2): what its rounds play; its songs are its Music.
			...(d.kind === 'hearing'
				? { hearing: hearingOf(typeof d.practice_json === 'string' ? d.practice_json : null) }
				: {}),
			figure: d.figure_id !== null ? { id: d.figure_id, label: v.label(d.figure_id) } : null,
			routine:
				d.routine_id !== null
					? { id: d.routine_id, name: v.byId('routines', d.routine_id)?.name ?? null }
					: null,
			links: v.where('links', 'exercise_id', d.id).map((l) => ({ url: l.url, title: l.title })),
			lessons: nameList(v, 'lesson', [
				...v.where('lesson_exercises', 'exercise_id', d.id).map((l) => l.lesson_id),
				d.lesson_id
			])
		})
	),
	getOne(
		'lesson',
		'Get a lesson',
		'A lesson: its day, notes, group and whether it is published, its videos with their sections (ms) and what each section links to, and the figures, routines, drills, positions and links it holds.',
		(v, l) => ({
			...item(v, 'lesson', l),
			day: l.lesson_day,
			notes: l.notes,
			...(l.team_id !== null ? { published: l.published_at !== null } : {}),
			videos: v.where('lesson_videos', 'lesson_id', l.id).map((vid) => ({
				id: vid.id,
				source_url: vid.source_url,
				sections: sections(v, 'lesson_video_id', vid.id)
			})),
			figures: v
				.where('lesson_figures', 'lesson_id', l.id)
				.filter((x) => v.byId('figures', x.figure_id))
				.map((x) => ({ id: x.figure_id, label: v.label(x.figure_id) })),
			routines: nameList(
				v,
				'routine',
				v.where('lesson_routines', 'lesson_id', l.id).map((x) => x.routine_id)
			),
			drills: nameList(
				v,
				'drill',
				v.where('lesson_exercises', 'lesson_id', l.id).map((x) => x.exercise_id)
			),
			positions: nameList(
				v,
				'position',
				v.where('lesson_positions', 'lesson_id', l.id).map((x) => x.position_id)
			),
			links: v.where('links', 'lesson_id', l.id).map((x) => ({ url: x.url, title: x.title }))
		})
	),
	getOne(
		'position',
		'Get a position',
		'A position: its hold (hands, frame, facing, crossed), notes, and the figures that start and end in it.',
		(v, p) => {
			const figuresAt = (table: string) =>
				v
					.where(table, 'position_id', p.id)
					.filter((x) => v.byId('figures', x.figure_id))
					.map((x) => ({ id: x.figure_id, label: v.label(x.figure_id) }));
			return {
				...item(v, 'position', p),
				notes: p.notes,
				hands: p.hands,
				frame: p.frame,
				facing: p.facing,
				crossed: p.crossed,
				starting_here: figuresAt('figure_start_positions'),
				ending_here: figuresAt('figure_end_positions')
			};
		}
	),
	tool(
		{
			name: 'list_groups',
			title: 'List groups',
			description:
				'The groups (classes) the person is in, with their role: owner, editor or member.',
			inputSchema: { type: 'object', properties: {}, additionalProperties: false }
		},
		(a) => parseNone(a, 'list_groups'),
		(_a, v, ctx) =>
			ok({
				groups: v
					.rows('teams')
					.filter((t) => t.deleted_at === null)
					.map((t) => ({
						id: t.id,
						name: t.name,
						role:
							v.where('team_members', 'team_id', t.id).find((m) => m.user_id === ctx.userId)
								?.role ?? null
					}))
			})
	),
	tool(
		{
			name: 'vocabulary',
			title: 'The person`s words',
			description:
				'The names the person uses: moves, figures, positions, routines and section labels. Use them when fixing or writing text, so it keeps their words.',
			inputSchema: { type: 'object', properties: {}, additionalProperties: false }
		},
		(a) => parseNone(a, 'vocabulary'),
		(_a, v) => {
			const words = (table: string, column: string, keep: (r: Row) => boolean = () => true) =>
				[
					...new Set(
						v
							.rows(table)
							.filter((r) => !archivedRow(r) && keep(r))
							.map((r) => r[column])
							.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
					)
				].sort((a, b) => a.localeCompare(b));
			return ok({
				moves: words('figure_groups', 'name'),
				figures: words('figures', 'name'),
				positions: words('positions', 'name'),
				routines: words('routines', 'name'),
				sections: words('video_spots', 'label')
			});
		}
	)
];

export const readTools: ToolModule = {
	defs: TOOLS.map((t) => t.def),
	impls: Object.fromEntries(TOOLS.map((t) => [t.def.name, t.impl]))
};
