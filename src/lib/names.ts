/** People's names. PURE and client-safe: a name is optional until /welcome asks for one. */

export const NAME_MAX = 60;

type Named = { firstName: string | null; lastName: string | null; email: string };

/** A trimmed name of 1–60 characters, or null. */
export function cleanName(raw: unknown): string | null {
	if (typeof raw !== 'string') return null;
	const v = raw.trim();
	return v.length >= 1 && v.length <= NAME_MAX ? v : null;
}

/** "Ana Kranjc", or the email when the person has no name yet. */
export function fullName(p: Named): string {
	const name = [p.firstName, p.lastName].filter(Boolean).join(' ');
	return name || p.email;
}

/**
 * The name to show in a list of people: the first name, or "Ana K." when two
 * share a first name (compared without case). No first name falls back to the email.
 */
export function shortNames(people: (Named & { id: string })[]): Map<string, string> {
	const count = new Map<string, number>();
	for (const p of people) {
		const k = p.firstName?.toLowerCase();
		if (k) count.set(k, (count.get(k) ?? 0) + 1);
	}
	const out = new Map<string, string>();
	for (const p of people) {
		if (!p.firstName) {
			out.set(p.id, p.email);
			continue;
		}
		const shared = (count.get(p.firstName.toLowerCase()) ?? 0) > 1;
		const initial = p.lastName ? Array.from(p.lastName)[0].toUpperCase() : '';
		out.set(p.id, shared && initial ? `${p.firstName} ${initial}.` : p.firstName);
	}
	return out;
}

/**
 * Whether a request must first be sent to /welcome: a signed-in person with no
 * first name asking for a page. The API, the media servers, /welcome and
 * /logout are left alone, so the app, a download and signing out keep working.
 */
const PASS = ['/api/', '/recordings/', '/audio/', '/count/', '/lesson-videos/', '/_app/'];
const PASS_EXACT = ['/welcome', '/logout', '/health'];
export function needsName(path: string, user: { firstName: string | null } | null): boolean {
	if (!user || user.firstName) return false;
	if (PASS_EXACT.includes(path)) return false;
	return !PASS.some((p) => path.startsWith(p));
}
