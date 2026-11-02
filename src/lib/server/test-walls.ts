/** Walls for specs only: two people, and the first one's two dances; two groups. */
import type { TeamSpace, Wall } from './scope';

export const U1_SALSA: Wall = { userId: 'u1', dance: 'salsa' };
export const U1_BACHATA: Wall = { userId: 'u1', dance: 'bachata' };
export const U2_SALSA: Wall = { userId: 'u2', dance: 'salsa' };

/** Two groups' salsa sides, u1 acting in both. */
export const T1_SALSA: TeamSpace = { teamId: 1, actorId: 'u1', dance: 'salsa' };
export const T2_SALSA: TeamSpace = { teamId: 2, actorId: 'u1', dance: 'salsa' };
