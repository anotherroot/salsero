/**
 * The first run's words and where it ends (levels spec, "First run"): three
 * slides, How much app?, Join your class. PURE, client-safe.
 */
import type { DanceSlug } from '$lib/dances/dances';

export const SLIDES: readonly { title: string; body: string }[] = [
	{
		title: 'Practise what you learned in class',
		body: 'Your teacher puts each class here. You watch it again and practise at home, a few minutes at a time.'
	},
	{
		title: 'A few things a day',
		body: 'Today shows just a handful. When they are done, you are done.'
	},
	{
		title: 'You say when it comes back',
		body: 'After practising, tap how it went. The app remembers for you.'
	}
];

export const LEVEL_STEP = {
	title: 'How much app?',
	note: 'You can change this any time in Settings'
};

export const JOIN_STEP = {
	title: 'Join your class',
	subtitle: 'Your teacher has the code',
	label: 'Class code',
	or: 'Or open the link your teacher sent, or scan the code on the studio wall.',
	notNow: 'Not now',
	join: 'Join'
};

export const CODE_REFUSALS = {
	empty: 'Enter the class code.',
	unknown: 'No class has this code. Check it and try again.',
	refused: 'This class was deleted, so it cannot be joined.'
} as const;

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
