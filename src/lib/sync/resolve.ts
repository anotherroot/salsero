/*
 * A clash resolved from the Sync page (offline phase 3): the form sent again,
 * with the person's picks over what was sent, and the version they compared
 * against as `seen`, so the clash check passes only if nobody changed it again.
 * PURE, client-safe.
 */
import type { Seen } from '$lib/clash/clash';

export function resendFields(
	fields: [string, string][],
	values: Record<string, string>,
	current: Seen
): [string, string][] {
	const out: [string, string][] = fields
		.filter(([k]) => k !== 'seen')
		.map(([k, v]) => [k, k in values ? values[k] : v]);
	out.push(['seen', JSON.stringify(current)]);
	return out;
}
