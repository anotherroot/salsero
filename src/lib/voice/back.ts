/**
 * Where My count (/voice) was opened from, and where its Back goes. PURE and
 * client-safe. Practice links its Voice row with `myCountHref`, carrying its
 * own path and query; `/voice` reads `?from=` back through `voiceBack`, which
 * accepts only a Practice page of a known dance — never an outside address.
 */
import { DANCE_SLUGS } from '$lib/dances/dances';
import type { PhrasePattern } from '$lib/labels';

const PRACTICE = new RegExp(`^/(${DANCE_SLUGS.join('|')})/player(\\?.*)?$`);
// You: the Groups list above Follow my class, its own page at it.
const YOU = new RegExp(`^/(${DANCE_SLUGS.join('|')})/(groups|you)$`);

/** `/voice`, plus `?from=<encoded>` and/or `pattern=<p>`. */
export function myCountHref(from?: string, pattern?: PhrasePattern): string {
	const q = new URLSearchParams();
	if (from) q.set('from', from);
	if (pattern) q.set('pattern', pattern);
	const s = q.toString();
	return s ? `/voice?${s}` : '/voice';
}

/**
 * `from` as `searchParams.get` returns it (already decoded; nothing is decoded
 * here). Practice only for `/<dance>/player…` with no `//` and no `\` anywhere
 * in it, You only for exactly `/<dance>/groups` or `/<dance>/you`; everything
 * else, garbled or foreign, is Settings.
 */
export function voiceBack(from: string | null): {
	href: string;
	label: 'Back to Settings' | 'Back to Practice' | 'Back to You';
} {
	if (from && PRACTICE.test(from) && !from.includes('//') && !from.includes('\\')) {
		return { href: from, label: 'Back to Practice' };
	}
	if (from && YOU.test(from)) return { href: from, label: 'Back to You' };
	return { href: '/settings', label: 'Back to Settings' };
}
