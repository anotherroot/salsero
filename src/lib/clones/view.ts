/**
 * The words of the clone and twin screens. PURE and client-safe: every
 * sentence a screen prints comes from here, so a spec can pin it.
 */
import type { CloneKind, SwitchReport } from '$lib/types';

/** "Salsa Tuesdays" → "Salsa Tuesdays’"; "Rueda club" → "Rueda club’s". */
export function possessive(name: string): string {
	return /s$/i.test(name) ? `${name}’` : `${name}’s`;
}

/** A group's row in a person's own list: "Salsa Tuesdays’ · used as it is". */
export function usedAsIs(team: string): string {
	return `${possessive(team)} · used as it is`;
}

/** A group's move beside the person's own of the same name: "Enchufla · Salsa Tuesdays". */
export function moveHeading(move: string, team?: { name: string }): string {
	return team ? `${move} · ${team.name}` : move;
}

/** The note at the top of a group's figure page: where the member got it, and what that means. */
export function fromLessonNote(lesson: string, team: string): string {
	return `From ${lesson}. Use it in your routines as it is; it stays ${possessive(team)}.`;
}

/** The note under a person's own slots when some of them are a group's figures. */
export function groupSlotNote(figures: string[], team: string): string {
	const names =
		figures.length > 2
			? `${figures.slice(0, -1).join(', ')} and ${figures[figures.length - 1]}`
			: figures.join(' and ');
	const verb = figures.length === 1 ? 'is' : 'are';
	return `${names} ${verb} ${possessive(team)}. If you leave the group, you keep a copy and this routine keeps working.`;
}

/** One `groupSlotNote` per group whose figures the slots use, in slot order. */
export function groupSlotNotes(
	groupFigures: Record<number, { team: string; name: string }>,
	slotFigureIds: number[][]
): string[] {
	const byTeam = new Map<string, string[]>();
	for (const id of slotFigureIds.flat()) {
		const g = groupFigures[id];
		if (!g) continue;
		const names = byTeam.get(g.team) ?? [];
		if (!names.includes(g.name)) names.push(g.name);
		byTeam.set(g.team, names);
	}
	return [...byTeam].map(([team, names]) => groupSlotNote(names, team));
}

/* ── Make it mine ───────────────────────────────────────────────────────── */

/** The button that makes a class's thing the person's own (ruling 12: Make my own copy too). */
export const MAKE_MINE = 'Make it mine';

/** The sheet's title: "Make Setenta · Básico yours?". */
export function makeMineTitle(label: string): string {
	return `Make ${label} yours?`;
}

export const MAKE_MINE_SUB = 'Editing makes your own copy. The class’s stays as it is.';

/** The sheet's line when the person's own copy is archived: Make it mine brings it back. */
export const restoreLine = 'You had your own copy. Restore it?';

/** Make it mine on a class song whose copy the person archived: a person's song has no restore. */
export const ARCHIVED_SONG_COPY =
	'Your copy of this song is archived. Delete it in Settings → What uses space to make it yours again.';

export const YOU_GET = 'YOU GET';

const GETS: Record<CloneKind, string> = {
	// Ruling 3: no sections, they sit on recordings, which stay the group's.
	figure: 'Its name, timing, positions and notes, to change as you like.',
	routine: 'Its name, notes and slots, to change as you like.',
	drill: 'Its name, notes and practice, to change as you like.',
	song: 'Its title, artist and count, to change as you like.',
	lesson:
		'Its title, notes, links, videos and sections, to change as you like. The videos count against your space.'
};

/** What the copy gives the person, per kind. */
export function youGet(kind: CloneKind): string {
	return GETS[kind];
}

/** What stays the group's: a figure's recordings (ruling 5: Edit brings none). Null for the rest. */
export function staysTheirs(kind: CloneKind, team: string): { title: string; body: string } | null {
	if (kind !== 'figure') return null;
	return {
		title: `STAYS ${possessive(team).toUpperCase()}`,
		body: 'Its recordings and their sections. You still see them inside yours, and can take one (it then counts against your space).'
	};
}

/** "A", "A and B", "A, B and C". */
function listed(names: string[]): string {
	return names.length > 1
		? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
		: (names[0] ?? '');
}

/**
 * The note before Make it mine: which of the person's own rows move onto the
 * copy. "Your routine Week 4 loop and your practice of it switch to your
 * copy." Null when nothing of theirs uses it.
 */
export function switchNote(r: SwitchReport, practised: boolean): string | null {
	const parts: { text: string; many: boolean }[] = [];
	const names = (one: string, many: string, list: string[]) => {
		if (list.length > 0)
			parts.push({
				text: `your ${list.length === 1 ? one : many} ${listed(list)}`,
				many: list.length > 1
			});
	};
	names(
		'routine',
		'routines',
		r.routines.map((x) => x.name)
	);
	names(
		'lesson',
		'lessons',
		r.lessons.map((x) => x.title)
	);
	if (r.sections === 1) parts.push({ text: 'your section', many: false });
	else if (r.sections > 1) parts.push({ text: `${r.sections} of your sections`, many: true });
	if (practised) parts.push({ text: 'your practice of it', many: false });
	if (parts.length === 0) return null;

	const texts = parts.map((p) => p.text);
	const last = texts[texts.length - 1];
	let body: string;
	if (texts.length === 1) body = last;
	else if (texts.some((t) => t.includes(' and ')))
		// "Your routines A and B, and your practice of it, switch…"
		body = `${texts.slice(0, -1).join(', ')}, and ${last},`;
	else body = `${texts.slice(0, -1).join(', ')} and ${last}`;
	const verb = parts.length === 1 && !parts[0].many ? 'switches' : 'switch';
	return `${body[0].toUpperCase()}${body.slice(1)} ${verb} to your copy.`;
}
