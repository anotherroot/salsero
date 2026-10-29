/** Client-safe helpers for the Link popup's rows. */
import type { LinkOption } from './types';

/**
 * A row's key: its target, never its label — two drills may share a name, and
 * a keyed each block throws on a repeated key.
 */
export function linkOptionKey(o: LinkOption): string {
	return 'figureId' in o.target ? `f${o.target.figureId}` : `e${o.target.exerciseId}`;
}
