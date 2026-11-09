/**
 * The kinds of change the AI may queue: one object each, calling the same data
 * function the app's own form calls. `parse` checks the AI's payload, `prepare`
 * (at propose) whether the person may do it and what it will overwrite, `run`
 * (inside a transaction) does it, `undo` takes it back.
 */
import type { Db } from '../../db';
import type { DanceSlug } from '$lib/dances/dances';
import type { CloneKind } from '$lib/types';
import type { Parsed } from '../../mcp/args';

/** Who queues and runs: the person (never "the AI"), their dance, and the connection. */
export type Who = { userId: string; dance: DanceSlug; grantId: number | null };

/** Why a run refused a line: a code the page words in the reader's language. */
export type Refusal = { code: string; args?: Record<string, string | number> };

export type Prepared =
	{ ok: true; before: Record<string, unknown> | null } | { ok: false; message: string };
export type Ran = { ok: true; result: Record<string, unknown> } | { ok: false; refusal: Refusal };
export type Undone = { ok: true } | { ok: false; refusal: Refusal };

export interface LineKind<P = unknown> {
	kind: string;
	/** For the AI: what the payload holds (the tool description lists these). */
	shape: string;
	parse(raw: Record<string, unknown>): Parsed<P>;
	prepare(db: Db, who: Who, p: P): Prepared;
	run(db: Db, who: Who, p: P, before: Record<string, unknown> | null, now: number): Ran;
	undo: null | ((db: Db, who: Who, p: P, result: Record<string, unknown>, now: number) => Undone);
	flows(db: Db, p: P, result: Record<string, unknown>): { kind: CloneKind; id: number } | null;
}

/** Every kind by name. Filled by the kind modules (`registerKinds`). */
export const KINDS: Record<string, LineKind> = {};

export function registerKinds(...kinds: LineKind<never>[]) {
	for (const k of kinds) {
		if (KINDS[k.kind]) throw new Error(`Two queue kinds are named ${k.kind}`);
		KINDS[k.kind] = k as unknown as LineKind;
	}
}
