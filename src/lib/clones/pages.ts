import type { CloneKind } from '$lib/types';

/**
 * The route of a family member's own page, per kind: the version tabs and the
 * copies list open a member here, with `{ dance, id }`. PURE, client-safe.
 */
export function memberRoute(kind: CloneKind) {
	switch (kind) {
		case 'figure':
			return '/[dance]/(moves)/figures/[id]' as const;
		case 'routine':
			return '/[dance]/(moves)/routines/[id]' as const;
		case 'drill':
			return '/[dance]/(today)/exercises/[id]' as const;
		case 'song':
			return '/[dance]/songs/[id]' as const;
		case 'lesson':
			return '/[dance]/lessons/[id]' as const;
		case 'position':
			return '/[dance]/(moves)/positions/[id]' as const;
	}
}
