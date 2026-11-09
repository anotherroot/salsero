/**
 * The AI's tools for its queue of actions (plan 2 of the AI connector). They
 * write only the queue's own tables: nothing the person has changes until the
 * person runs it on the Suggestions page. Texts are for the AI: English.
 */
import type { ToolDef, ToolResult } from '$lib/mcp/protocol';
import { KINDS, type Who } from '../ai-queue/kinds';
import '../ai-queue/kinds/all';
import {
	changeAction,
	moveAction,
	propose,
	queueOf,
	removeGroup,
	setGroup,
	withdrawAction,
	type LineIn,
	type QueueAction
} from '../ai-queue/store';
import { refuse, unknownKey, wholeNumber, type Parsed } from './args';
import type { Impl, ToolCtx, ToolModule } from './modules';

const ok = (data: unknown): ToolResult => ({ isError: false, text: JSON.stringify(data) });
const no = (text: string): ToolResult => ({ isError: true, text });
const whoOf = (ctx: ToolCtx): Who => ({
	userId: ctx.userId,
	dance: ctx.dance,
	grantId: ctx.grantId
});

const WRITE = {
	readOnlyHint: false,
	destructiveHint: false,
	idempotentHint: false,
	openWorldHint: false
} as const;
const READ = {
	readOnlyHint: true,
	destructiveHint: false,
	idempotentHint: true,
	openWorldHint: false
} as const;

const intArg = (v: unknown, key: string): Parsed<number> => {
	const n = wholeNumber(v, 1, Number.MAX_SAFE_INTEGER);
	return n === null ? refuse(`${key} must be a whole number.`) : { ok: true, args: n };
};
const optInt = (v: unknown, key: string): Parsed<number | undefined> =>
	v === undefined ? { ok: true, args: undefined } : intArg(v, key);
const intList = (v: unknown, key: string): Parsed<number[] | undefined> => {
	if (v === undefined) return { ok: true, args: undefined };
	if (!Array.isArray(v) || !v.every((x) => wholeNumber(x, 1, Number.MAX_SAFE_INTEGER) !== null))
		return refuse(`${key} must be a list of action ids.`);
	return { ok: true, args: v as number[] };
};

/** Where an action stands, as the AI is told. */
function stateOf(a: QueueAction): string {
	const work = a.lines.filter((l) => l.status !== 'left_out');
	if (work.every((l) => l.status === 'done')) return 'done';
	if (work.every((l) => l.status === 'dropped')) return 'dropped';
	if (work.some((l) => l.status === 'done')) return 'partly done';
	return 'pending';
}

const lineSchema = {
	type: 'object',
	properties: { kind: { type: 'string' } },
	required: ['kind'],
	additionalProperties: true
};

type Tool = { def: ToolDef; impl: Impl };
const tool = (def: ToolDef, impl: Impl): Tool => ({ def, impl });

function kindsList(): string {
	return Object.values(KINDS)
		.map((k) => `${k.kind} ${k.shape}`)
		.join('; ');
}

const TOOLS: Tool[] = [
	tool(
		{
			name: 'queue',
			title: 'The queue',
			description:
				'Your queue of suggested changes as the person sees it: groups, actions (cards, numbered) and their lines, with each line`s status (pending, left_out, done, dropped, undone) and, for a pending line a run refused, why.',
			inputSchema: { type: 'object', properties: {}, additionalProperties: false },
			annotations: READ
		},
		async (args, ctx) => {
			const extra = unknownKey(args, [], 'queue', 'no arguments');
			if (extra) return no(extra);
			return ok({
				groups: queueOf(ctx.db, ctx.userId, ctx.dance, ctx.now).map((g) => ({
					id: g.id,
					title: g.title,
					actions: g.actions.map((a) => ({
						id: a.id,
						n: a.n,
						title: a.title,
						state: stateOf(a),
						version: a.version,
						needs: a.needs,
						lines: a.lines.map((l) => ({
							id: l.id,
							kind: l.kind,
							payload: l.payload,
							status: l.status,
							...(l.refusal ? { refusal: l.refusal } : {})
						}))
					}))
				}))
			});
		}
	),
	tool(
		{
			name: 'propose',
			title: 'Suggest a change',
			description: `Add one action (one card for the person) to the queue: a title, and one or more lines, each a change of one kind. Nothing changes until the person runs it in the app. Put it in an existing group (group_id) or a new one (group_title). needs: actions that must run first; a {"ref": <action id>} in a line (the id an earlier action creates) adds that action to needs by itself. Kinds: ${'{KINDS}'}`,
			inputSchema: {
				type: 'object',
				properties: {
					group_id: { type: 'integer', minimum: 1 },
					group_title: { type: 'string', minLength: 1, maxLength: 100 },
					title: { type: 'string', minLength: 1, maxLength: 200 },
					lines: { type: 'array', items: lineSchema, minItems: 1, maxItems: 50 },
					needs: { type: 'array', items: { type: 'integer', minimum: 1 } }
				},
				required: ['title', 'lines'],
				additionalProperties: false
			},
			annotations: WRITE
		},
		async (args, ctx) => {
			const extra = unknownKey(
				args,
				['group_id', 'group_title', 'title', 'lines', 'needs'],
				'propose',
				'group_id or group_title, title, lines and needs'
			);
			if (extra) return no(extra);
			if ((args.group_id === undefined) === (args.group_title === undefined))
				return no(
					'Give exactly one of group_id (an existing group) and group_title (a new group).'
				);
			const groupId = optInt(args.group_id, 'group_id');
			if (!groupId.ok) return no(groupId.message);
			const needs = intList(args.needs, 'needs');
			if (!needs.ok) return no(needs.message);
			const r = propose(
				ctx.db,
				whoOf(ctx),
				{
					group:
						groupId.args !== undefined ? { id: groupId.args } : { title: String(args.group_title) },
					title: typeof args.title === 'string' ? args.title : '',
					lines: args.lines as LineIn[],
					needs: needs.args
				},
				ctx.now
			);
			return r.ok ? ok({ action_id: r.actionId, group_id: r.groupId }) : no(r.message);
		}
	),
	tool(
		{
			name: 'change_action',
			title: 'Change a suggestion',
			description:
				'Change one of your pending actions: its title, its lines (replaced whole), its needs, or its group. Only while none of it has run or been dropped. The person sees that you changed it, and a run of the old version is refused.',
			inputSchema: {
				type: 'object',
				properties: {
					id: { type: 'integer', minimum: 1 },
					title: { type: 'string', minLength: 1, maxLength: 200 },
					lines: { type: 'array', items: lineSchema, minItems: 1, maxItems: 50 },
					needs: { type: 'array', items: { type: 'integer', minimum: 1 } },
					group_id: { type: 'integer', minimum: 1 }
				},
				required: ['id'],
				additionalProperties: false
			},
			annotations: WRITE
		},
		async (args, ctx) => {
			const extra = unknownKey(
				args,
				['id', 'title', 'lines', 'needs', 'group_id'],
				'change_action',
				'id, title, lines, needs and group_id'
			);
			if (extra) return no(extra);
			const id = intArg(args.id, 'id');
			if (!id.ok) return no(id.message);
			const needs = intList(args.needs, 'needs');
			if (!needs.ok) return no(needs.message);
			const groupId = optInt(args.group_id, 'group_id');
			if (!groupId.ok) return no(groupId.message);
			if (args.title !== undefined && typeof args.title !== 'string')
				return no('title must be text.');
			const r = changeAction(
				ctx.db,
				whoOf(ctx),
				id.args,
				{
					title: args.title as string | undefined,
					lines: args.lines as LineIn[] | undefined,
					needs: needs.args,
					groupId: groupId.args
				},
				ctx.now
			);
			return r.ok ? ok({ changed: id.args }) : no(r.message);
		}
	),
	tool(
		{
			name: 'withdraw_action',
			title: 'Withdraw a suggestion',
			description: 'Take back one of your pending actions; the person no longer sees it.',
			inputSchema: {
				type: 'object',
				properties: { id: { type: 'integer', minimum: 1 } },
				required: ['id'],
				additionalProperties: false
			},
			annotations: WRITE
		},
		async (args, ctx) => {
			const extra = unknownKey(args, ['id'], 'withdraw_action', 'id');
			if (extra) return no(extra);
			const id = intArg(args.id, 'id');
			if (!id.ok) return no(id.message);
			const r = withdrawAction(ctx.db, whoOf(ctx), id.args, ctx.now);
			return r.ok ? ok({ withdrawn: id.args }) : no(r.message);
		}
	),
	tool(
		{
			name: 'move_action',
			title: 'Move a suggestion',
			description:
				'Put an action before another in its group (before_id), last (no before_id), or into another group (group_id).',
			inputSchema: {
				type: 'object',
				properties: {
					id: { type: 'integer', minimum: 1 },
					group_id: { type: 'integer', minimum: 1 },
					before_id: { type: 'integer', minimum: 1 }
				},
				required: ['id'],
				additionalProperties: false
			},
			annotations: WRITE
		},
		async (args, ctx) => {
			const extra = unknownKey(
				args,
				['id', 'group_id', 'before_id'],
				'move_action',
				'id, group_id and before_id'
			);
			if (extra) return no(extra);
			const id = intArg(args.id, 'id');
			if (!id.ok) return no(id.message);
			const groupId = optInt(args.group_id, 'group_id');
			if (!groupId.ok) return no(groupId.message);
			const before = optInt(args.before_id, 'before_id');
			if (!before.ok) return no(before.message);
			const r = moveAction(
				ctx.db,
				whoOf(ctx),
				id.args,
				{ groupId: groupId.args, before: before.args ?? null },
				ctx.now
			);
			return r.ok ? ok({ moved: id.args }) : no(r.message);
		}
	),
	tool(
		{
			name: 'set_group',
			title: 'Make or rename a group',
			description:
				'Without id: a new group (a heading the person can run at once). With id: rename it. before_id puts it before another group.',
			inputSchema: {
				type: 'object',
				properties: {
					id: { type: 'integer', minimum: 1 },
					title: { type: 'string', minLength: 1, maxLength: 100 },
					before_id: { type: 'integer', minimum: 1 }
				},
				required: ['title'],
				additionalProperties: false
			},
			annotations: WRITE
		},
		async (args, ctx) => {
			const extra = unknownKey(
				args,
				['id', 'title', 'before_id'],
				'set_group',
				'id, title and before_id'
			);
			if (extra) return no(extra);
			const id = optInt(args.id, 'id');
			if (!id.ok) return no(id.message);
			const before = optInt(args.before_id, 'before_id');
			if (!before.ok) return no(before.message);
			const r = setGroup(
				ctx.db,
				whoOf(ctx),
				{
					id: id.args,
					title: typeof args.title === 'string' ? args.title : '',
					before: before.args
				},
				ctx.now
			);
			return r.ok ? ok({ group_id: r.groupId }) : no(r.message);
		}
	),
	tool(
		{
			name: 'remove_group',
			title: 'Remove a group',
			description: 'Withdraw every pending action in a group. What the person ran stays theirs.',
			inputSchema: {
				type: 'object',
				properties: { id: { type: 'integer', minimum: 1 } },
				required: ['id'],
				additionalProperties: false
			},
			annotations: WRITE
		},
		async (args, ctx) => {
			const extra = unknownKey(args, ['id'], 'remove_group', 'id');
			if (extra) return no(extra);
			const id = intArg(args.id, 'id');
			if (!id.ok) return no(id.message);
			const r = removeGroup(ctx.db, whoOf(ctx), id.args, ctx.now);
			return r.ok ? ok({ removed: id.args }) : no(r.message);
		}
	)
];

/** The kinds' shapes go into propose's description once every kind is registered. */
for (const t of TOOLS)
	if (t.def.name === 'propose')
		t.def.description = t.def.description.replace('{KINDS}', kindsList());

export const queueTools: ToolModule = {
	defs: TOOLS.map((t) => t.def),
	impls: Object.fromEntries(TOOLS.map((t) => [t.def.name, t.impl]))
};
