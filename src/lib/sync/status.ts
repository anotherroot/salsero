/*
 * The band's sync status and the Waiting badge (offline phase 3, looks 1D and
 * 3B). PURE, client-safe. Nothing shows while all is synced; a change that
 * goes up within the grace never shows at all (the person picked a status that
 * never nags).
 */
import type { OutboxSummary } from '$lib/offline/protocol';

export const WAITING_GRACE_MS = 2000;

export type SyncStatus =
	| { kind: 'none' }
	| { kind: 'waiting'; count: number }
	| { kind: 'refused'; count: number }
	| { kind: 'signin' };

/** Couldn't sync first, then sign in, then waiting (only once the oldest has waited the grace), else nothing. */
export function syncStatus(s: OutboxSummary | null, now: number): SyncStatus {
	if (!s) return { kind: 'none' };
	if (s.refused > 0) return { kind: 'refused', count: s.refused };
	if (s.signedOut) return { kind: 'signin' };
	if (s.waiting > 0 && s.oldestWaitingAt !== null && s.oldestWaitingAt + WAITING_GRACE_MS <= now) {
		return { kind: 'waiting', count: s.waiting };
	}
	return { kind: 'none' };
}

/** What the band says: only what needs the person (couldn't sync, sign in); what waits is the offline strip's (look C2). */
export function bandStatus(s: OutboxSummary | null, now: number): SyncStatus {
	const status = syncStatus(s, now);
	return status.kind === 'waiting' ? { kind: 'none' } : status;
}

/** When "waiting" would start showing, if later than now; null otherwise. */
export function graceEndsAt(s: OutboxSummary | null, now: number): number | null {
	if (!s || s.waiting === 0 || s.oldestWaitingAt === null) return null;
	const at = s.oldestWaitingAt + WAITING_GRACE_MS;
	return at > now ? at : null;
}

/** Whether a thing carries the Waiting badge: its entry is still on its way, past the grace. */
export function waitingMark(
	s: OutboxSummary | null,
	table: string,
	key: string | number,
	now: number
): boolean {
	const madeAt = s?.queued[`${table}:${key}`];
	return madeAt !== undefined && madeAt + WAITING_GRACE_MS <= now;
}
