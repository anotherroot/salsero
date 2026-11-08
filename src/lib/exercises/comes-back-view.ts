/**
 * Comes back's words for the exercise page, the New exercise sheet and a member's
 * line. PURE. A setting's own words (`comesBackWords`, also History's) live in
 * `$lib/schedule/comes-back`; this file only re-exports them and adds the notes.
 */
import { comesBackWords, rhythmWords, type ComesBack } from '$lib/schedule/comes-back';

export { comesBackWords, rhythmWords };

/** The fixed rhythms, in the chips' order. */
export const RHYTHMS = [1, 2, 3, 7] as const;
/** The "good days" chips. */
export const GOOD_DAYS = [3, 5] as const;

export const GOOD_MEANS = "Good means I've got it or Easy.";

/** Under the "good days" chips: "Good means I've got it or Easy. 2 of 3 so far." `good` null: no count. */
export function learningNote(good: number | null, of: 3 | 5): string {
	return good === null ? GOOD_MEANS : `${GOOD_MEANS} ${Math.min(good, of)} of ${of} so far.`;
}

/** A member's line over the card: "Your teacher set: every day until it feels good on 3 days". */
export function teacherLine(c: ComesBack): string {
	const words = comesBackWords(c);
	return `Your teacher set: ${words.charAt(0).toLowerCase()}${words.slice(1)}`;
}

/** What the Comes back card edits: the page load's `comes` (null where the type has none). */
export interface ComesSettings {
	/** What the card shows selected: its own, else the class drill's, else the faces. */
	value: ComesBack;
	/** The row's own; null for an entry following its class drill. */
	own: ComesBack | null;
	/** An entry's class drill's setting; null otherwise. */
	teacher: ComesBack | null;
	/** A group drill's own: "Comes back, for the class". */
	forClass: boolean;
	/** Good days since the switch, for "N of M so far"; null where there is no log (a group's drill). */
	good: number | null;
}

/** What the card has chosen so far (its own state, not the stored setting). */
export interface ComesBackChoice {
	/** The person changed something on the card. */
	touched: boolean;
	useTeacher: boolean;
	mode: 'faces' | 'every';
	until: boolean;
	good: 3 | 5;
	every: 1 | 2 | 3 | 7;
}

/**
 * The form fields the card posts (the ones `readComesBack` reads). An untouched card
 * posts none, for every row, so saving something else keeps what is stored: an
 * entry keeps following its class drill (even one with no setting yet), and a row
 * with none stays null (a group drill's `seen` does not change under another editor).
 */
export function postedFields(c: ComesBackChoice): Record<string, string> {
	if (c.useTeacher) return { comesBack: 'teacher' };
	if (!c.touched) return {};
	if (c.mode === 'every') return { comesBack: 'every', every: String(c.every) };
	if (c.until) return { comesBack: 'faces', until: 'on', good: String(c.good) };
	return { comesBack: 'faces' };
}
