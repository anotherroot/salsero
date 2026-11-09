import type { ToolDef, ToolResult } from '$lib/mcp/protocol';
import type { DanceSlug } from '$lib/dances/dances';
import type { Db } from '../db';
import { readTools } from './read';

/** What a tool runs with: the db, who is asking (the token's person) and their dance, which grant, and when. */
export type ToolCtx = { db: Db; userId: string; dance: DanceSlug; grantId: number; now: number };
export type Impl = (args: Record<string, unknown>, ctx: ToolCtx) => Promise<ToolResult>;
export type ToolModule = { defs: ToolDef[]; impls: Record<string, Impl> };

export const TOOL_MODULES: ToolModule[] = [readTools];
