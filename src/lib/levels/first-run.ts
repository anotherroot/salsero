/**
 * The first run's words and where it ends (levels spec, "First run"): three
 * slides, How much app?, Join your class. PURE, client-safe.
 */
import type { DanceSlug } from '$lib/dances/dances';
import { t, type Catalog } from '$lib/i18n/catalog';

/** The three slides. */
export function slides(): readonly { title: string; body: string }[] {
	return t().entry.firstRun.slides;
}

/** How much app? */
export function levelStep(): { title: string; note: string } {
	return t().entry.firstRun.level;
}

/** Join your class: the first run's step, the code field, My class with no class. */
export function joinStep(): Catalog['entry']['firstRun']['join'] {
	return t().entry.firstRun.join;
}

/** Why a typed class code joined nothing. */
export function codeRefusal(reason: 'empty' | 'unknown' | 'refused'): string {
	return t().entry.firstRun.code[reason];
}

/** The code in a `/g/<code>` path (the teacher's link), or null. */
export function inviteCodeOf(next: string): string | null {
	const m = /^\/g\/([^/?#]+)/.exec(next);
	if (!m) return null;
	try {
		return decodeURIComponent(m[1]);
	} catch {
		return null;
	}
}

/**
 * Where the first run ends after a join: `next`, unless it is only the door
 * (`/`) or the teacher's link we just used; then the joined class's dance's Today.
 */
export function afterJoin(next: string, dance: DanceSlug): string {
	return next === '/' || inviteCodeOf(next) !== null ? `/${dance}` : next;
}

/** Where it ends on Not now: `next`, but never back to a join link we just declined. */
export function afterSkip(next: string): string {
	return inviteCodeOf(next) !== null ? '/' : next;
}

/** The first run's join step: the same page, `step=join`, remembering where we were going. */
export function joinStepHref(next: string): string {
	return `/welcome/start?step=join&next=${encodeURIComponent(next)}`;
}
