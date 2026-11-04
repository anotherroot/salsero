/** Walls for specs only: two people, and the first one's two dances; two groups; fake files. */
import type { TeamSpace, Wall } from './scope';
import type { CloneFiles } from './clones/files';

export const U1_SALSA: Wall = { userId: 'u1', dance: 'salsa' };
export const U1_BACHATA: Wall = { userId: 'u1', dance: 'bachata' };
export const U2_SALSA: Wall = { userId: 'u2', dance: 'salsa' };

/** Two groups' salsa sides, u1 acting in both. */
export const T1_SALSA: TeamSpace = { teamId: 1, actorId: 'u1', dance: 'salsa' };
export const T2_SALSA: TeamSpace = { teamId: 2, actorId: 'u1', dance: 'salsa' };

/**
 * `CloneFiles` for specs that keep copies (leaving, removal) without real
 * files: a new name is `copy-<file>`, nothing on disk.
 */
export const NO_FILES: CloneFiles = {
	link: async (_kind, file) => `copy-${file}`,
	unlink: async () => {}
};
