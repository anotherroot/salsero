/*
 * The Sync page's and the band status's words (offline phase 3). Client-safe;
 * reads `t()` at call time.
 */
import { t } from '$lib/i18n/catalog';
import { localDay, timeOfDay } from '$lib/day/day';
import { weekdayShort } from '$lib/format';
import type { OutboxItem } from '$lib/offline/protocol';
import type { EntryLabel } from './outbox';
import type { SyncStatus } from './status';
import type { Strip } from './strip';

/** The band's words for a status; null when it says nothing. */
export function statusText(s: SyncStatus): string | null {
	const w = t().sync.status;
	if (s.kind === 'waiting') return w.waiting(s.count);
	if (s.kind === 'refused') return w.refused(s.count);
	if (s.kind === 'signin') return w.signIn;
	return null;
}

/** The offline strip's words; null: no strip. */
export function stripText(s: Strip): string | null {
	const w = t().sync.strip;
	if (s === null) return null;
	if (s.kind === 'offline') return w.offline(s.count);
	if (s.kind === 'waiting') return w.waiting(s.count);
	if (s.kind === 'sending') return w.sending(s.count);
	return w.sent;
}

const when = (at: number, tz: string) => `${weekdayShort(localDay(at, tz))} ${timeOfDay(at, tz)}`;

/** What an entry was: "Log · Enchufla drill · Tue 10:04", "Note on Dile que no". */
export function labelText(label: EntryLabel, madeAt: number, tz: string): string {
	const w = t().sync.label;
	const thing = label.thing;
	if (label.kind === 'heart') return w.heart;
	if (!thing) return w.other;
	switch (label.kind) {
		case 'log':
			return w.log(thing, when(madeAt, tz));
		case 'note':
			return w.note(thing);
		case 'name':
			return w.name(thing);
		case 'new':
			return w.new(thing);
		case 'removed':
			return w.removed(thing);
		case 'edit':
			return w.edit(thing);
		case 'comment':
			return w.comment(thing);
		default:
			return w.other;
	}
}

/** Why an entry did not land, in plain words: the server's own for a plain refusal. */
export function reasonText(
	item: Pick<OutboxItem, 'reason' | 'message' | 'clash' | 'state'>
): string {
	const w = t().sync;
	if (item.state === 'held') return w.held;
	switch (item.reason) {
		case 'refused':
			return item.message ?? w.reason.error;
		case 'gone':
			return w.reason.gone;
		case 'clash':
			return w.reason.clash(item.clash?.by ?? null);
		case 'stale':
			return w.reason.stale;
		case 'access':
			return w.reason.access;
		case 'not-allowed':
			return w.reason.notAllowed;
		case 'bad-ids':
			return w.reason.badIds;
		default:
			return w.reason.error;
	}
}

/** "Last synced 10:42" today, "Last synced Mon 10:42" before; "Not synced yet". */
export function lastSyncedText(at: number | null, now: number, tz: string): string {
	const w = t().sync;
	if (at === null) return w.never;
	const today = localDay(now, tz) === localDay(at, tz);
	return w.lastSynced(today ? timeOfDay(at, tz) : when(at, tz));
}

export function discardQuestion(dependents: number): { title: string; body: string } {
	const w = t().sync;
	return {
		title: w.discardTitle,
		body: dependents > 0 ? `${w.discardBody} ${w.discardMore(dependents)}` : w.discardBody
	};
}

export function signOutQuestion(n: number): { title: string; body: string; confirm: string } {
	const w = t().sync.signOut;
	return { title: w.title(n), body: w.body, confirm: w.confirm };
}
