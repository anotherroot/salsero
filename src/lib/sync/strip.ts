/*
 * The offline strip (offline phase 3, look C2, picked 2026-11-09): an amber
 * strip above the page's own bottom bar and the tab bar that says the phone is
 * offline and how many changes wait; back online it says it is sending, then
 * "all sent" for a moment. PURE, client-safe: the component keeps the marks
 * and the clock.
 */
import type { OutboxSummary } from '$lib/offline/protocol';
import { WAITING_GRACE_MS } from './status';

/** How long after the connection comes back waiting changes read "sending". */
export const SENDING_WINDOW_MS = 30_000;
/** How long "all sent" stays. */
export const SENT_SHOW_MS = 2000;

export type Strip =
	| { kind: 'offline'; count: number }
	| { kind: 'waiting'; count: number }
	| { kind: 'sending'; count: number }
	| { kind: 'sent' }
	| null;

/** When the connection came back, and until when "all sent" shows. */
export type StripMarks = { backOnlineAt: number | null; sentUntil: number | null };

/** What the strip says now; null: no strip. */
export function stripState(
	online: boolean,
	s: OutboxSummary | null,
	now: number,
	marks: StripMarks
): Strip {
	const waiting = s?.waiting ?? 0;
	if (!online) return { kind: 'offline', count: waiting };
	if (waiting > 0 && s) {
		if (marks.backOnlineAt !== null && now - marks.backOnlineAt < SENDING_WINDOW_MS) {
			return { kind: 'sending', count: waiting };
		}
		// A change that goes up within the grace never shows (no nag online).
		if (s.oldestWaitingAt !== null && s.oldestWaitingAt + WAITING_GRACE_MS <= now) {
			return { kind: 'waiting', count: waiting };
		}
		return null;
	}
	return marks.sentUntil !== null && now < marks.sentUntil ? { kind: 'sent' } : null;
}

/**
 * The marks after a change of connection or outbox: back online sets the
 * moment; changes that were on the strip and are now all gone set "all sent".
 */
export function nextMarks(
	prev: { online: boolean; waiting: number; shown: boolean },
	next: { online: boolean; waiting: number },
	now: number,
	marks: StripMarks
): StripMarks {
	let { backOnlineAt, sentUntil } = marks;
	if (!next.online) backOnlineAt = null;
	else if (!prev.online) backOnlineAt = now;
	if (next.online && prev.waiting > 0 && next.waiting === 0 && prev.shown) {
		sentUntil = now + SENT_SHOW_MS;
	}
	return { backOnlineAt, sentUntil };
}

/** When the strip's words would next change by the clock alone (grace, window, "all sent"); null: never. */
export function nextTick(s: OutboxSummary | null, now: number, marks: StripMarks): number | null {
	const at = [
		s && s.waiting > 0 && s.oldestWaitingAt !== null ? s.oldestWaitingAt + WAITING_GRACE_MS : null,
		marks.backOnlineAt !== null ? marks.backOnlineAt + SENDING_WINDOW_MS : null,
		marks.sentUntil
	].filter((t): t is number => t !== null && t > now);
	return at.length ? Math.min(...at) : null;
}
