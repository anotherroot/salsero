/** PURE: the admin page's wording and the limit presets. Client-safe. */
import type { Channel } from './app-update/agent';
import { daysBetween } from './day/day';
import { DANCES, DANCE_SLUGS, type DanceSlug } from './dances/dances';
import { byteSize, dateLabel, dayLabel, plural } from './format';

const GIB = 1024 ** 3;

/** The preset limits, in GB (GiB), as the buttons show them. */
export const LIMIT_PRESETS_GB = [2, 5, 10] as const;

export function presetLabel(gb: number): string {
	return `${gb} GB`;
}

/** GB (a number the admin typed or a preset) → bytes; undefined unless positive and sane. */
export function gbToBytes(gb: number): number | undefined {
	if (!Number.isFinite(gb) || gb <= 0 || gb > 100_000) return undefined;
	const bytes = Math.round(gb * GIB);
	return bytes > 0 ? bytes : undefined;
}

/** "840 MB of 1.0 GB", or "840 MB, no limit". */
export function usesLine(used: number, limit: number | null): string {
	return limit === null ? `${byteSize(used)}, no limit` : `${byteSize(used)} of ${byteSize(limit)}`;
}

/** A request's lead: "Uses 840 MB of 1.0 GB". */
export function requestUsesLine(used: number, limit: number | null): string {
	return `Uses ${usesLine(used, limit)}`;
}

/** A person row's second line: "Joined 2 Nov 2026 · 840 MB of 1.0 GB". */
export function personMeta(p: {
	day: string;
	usedBytes: number;
	limitBytes: number | null;
}): string {
	return `Joined ${dateLabel(p.day)} · ${usesLine(p.usedBytes, p.limitBytes)}`;
}

/** The top of the admin page: "Limits add up to 12 GB · 8.0 GB free". */
export function limitsLine(sum: number, free: number): string {
	return `Limits add up to ${byteSize(sum)} · ${byteSize(free)} free`;
}

/** A group row's second line: "Ana Kranjc · 3 people · 120 MB of 600 MB". */
export function groupMeta(g: {
	owner: string;
	people: number;
	usedBytes: number;
	limitBytes: number;
	deleted: boolean;
}): string {
	return [
		g.owner,
		plural(g.people, 'person', 'people'),
		`${byteSize(g.usedBytes)} of ${byteSize(g.limitBytes)}`,
		g.deleted ? 'deleted' : null
	]
		.filter(Boolean)
		.join(' · ');
}

/** A person row's group line, per dance: "Groups made: Salsa 2, Bachata 0 · limit 2 per dance". */
export function groupsMadeLine(made: Record<DanceSlug, number>, limit: number): string {
	const counts = DANCE_SLUGS.map((d) => `${DANCES[d].label} ${made[d]}`).join(', ');
	return `Groups made: ${counts} · limit ${limit} per dance`;
}

/** A request's heading: the person's email, or the group's name with its owner. */
export function requestTitle(r: { email: string; teamName: string | null }): string {
	return r.teamName === null ? r.email : `${r.teamName} · ${r.email}`;
}

/** A person's app versions, one line per dance: "Salsa app 2 · today", "Bachata: no app". */
export function appsLines(
	seen: { dance: DanceSlug; versionCode: number; channel: Channel; day: string }[],
	today: string
): string[] {
	return DANCE_SLUGS.map((dance) => {
		const label = DANCES[dance].label;
		const s = seen.find((x) => x.dance === dance);
		if (!s) return `${label}: no app`;
		const age = daysBetween(s.day, today);
		const when = age <= 0 ? 'today' : age === 1 ? 'yesterday' : dayLabel(s.day);
		const play = s.channel === 'play' ? ' (Play)' : '';
		return `${label} app ${s.versionCode}${play} · ${when}`;
	});
}
