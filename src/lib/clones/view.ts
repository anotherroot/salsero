/**
 * The words of the clone and twin screens. PURE and client-safe: every
 * sentence a screen prints comes from here, so a spec can pin it.
 */

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
