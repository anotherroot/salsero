/** PURE: the admin page's wording and the limit presets. Client-safe. */
import type { Channel } from './app-update/agent';
import { daysBetween, localDay, timeOfDay } from './day/day';
import { deviceLine } from './feedback/device';
import { fullName } from './names';
import { DANCES, type DanceSlug } from './dances/dances';
import { byteSize, dateLabel, dayLabel } from './format';
import { t } from './i18n/catalog';

const GIB = 1024 ** 3;

/** The preset limits, in GB (GiB), as the buttons show them. */
export const LIMIT_PRESETS_GB = [2, 5, 10] as const;

/** "2 GB"; "0,5 GB" in Slovenian. */
export function presetLabel(gb: number): string {
	return t().admin.preset(gb);
}

/** GB (a number the admin typed or a preset) → bytes; undefined unless positive and sane. */
export function gbToBytes(gb: number): number | undefined {
	if (!Number.isFinite(gb) || gb <= 0 || gb > 100_000) return undefined;
	const bytes = Math.round(gb * GIB);
	return bytes > 0 ? bytes : undefined;
}

/** "840 MB of 1.0 GB", or "840 MB, no limit". */
export function usesLine(used: number, limit: number | null): string {
	const w = t().admin;
	return limit === null ? w.usesNoLimit(byteSize(used)) : w.usesOf(byteSize(used), byteSize(limit));
}

/** A request's lead: "Uses 840 MB of 1.0 GB". */
export function requestUsesLine(used: number, limit: number | null): string {
	return t().admin.requestUses(usesLine(used, limit));
}

/** A person row's second line: "Joined 2 Nov 2026 · 840 MB of 1.0 GB". */
export function personMeta(p: {
	day: string;
	usedBytes: number;
	limitBytes: number | null;
}): string {
	return t().admin.personMeta(dateLabel(p.day), usesLine(p.usedBytes, p.limitBytes));
}

/** The top of the admin page: "Limits add up to 12 GB · 8.0 GB free". */
export function limitsLine(sum: number, free: number): string {
	return t().admin.limitsLine(byteSize(sum), byteSize(free));
}

/** A group row's second line: "Ana Kranjc · 3 people · 120 MB of 600 MB". */
export function groupMeta(g: {
	owner: string;
	people: number;
	usedBytes: number;
	limitBytes: number;
	deleted: boolean;
}): string {
	const c = t();
	return [
		g.owner,
		c.nouns.people(g.people),
		usesLine(g.usedBytes, g.limitBytes),
		g.deleted ? c.admin.deleted : null
	]
		.filter(Boolean)
		.join(' · ');
}

/** A person row's group line, in the admin's dance: "Groups made: 2 · limit 3". */
export function groupsMadeLine(made: number, limit: number): string {
	return t().admin.groupsMade(made, limit);
}

/** A request's heading: the person's email, or the group's name with its owner. */
export function requestTitle(r: { email: string; teamName: string | null }): string {
	return r.teamName === null ? r.email : `${r.teamName} · ${r.email}`;
}

/**
 * A person's app version in their dance (an account belongs to one, the dance
 * split): "Salsa app 2 · today", or "Bachata: no app". One line, as a list.
 */
export function appsLines(
	seen: { dance: DanceSlug; versionCode: number; channel: Channel; day: string }[],
	today: string,
	accountDance: DanceSlug
): string[] {
	const c = t();
	return [accountDance].map((dance) => {
		const label = DANCES[dance].label;
		const s = seen.find((x) => x.dance === dance);
		if (!s) return c.admin.noApp(label);
		const age = daysBetween(s.day, today);
		const when = age <= 0 ? c.format.today : age === 1 ? c.format.yesterday : dayLabel(s.day);
		const play = s.channel === 'play' ? ' (Play)' : '';
		return c.admin.app(label, s.versionCode, play, when);
	});
}

/** "10 Nov, 13:04" in the admin's zone. */
function whenLabel(at: number, tz: string): string {
	return `${dayLabel(localDay(at, tz))}, ${timeOfDay(at, tz)}`;
}

/** What the admin page shows of one feedback message (the server reads the row). */
export interface FeedbackView {
	id: number;
	who: string;
	email: string;
	message: string;
	/** "Sent 10 Nov, 13:04". */
	sent: string;
	/** The facts under it, one per line: the page, the pages before, the app or browser, the window, the site's build. */
	lines: string[];
	errors: string[];
	userAgent: string | null;
	done: boolean;
}

/**
 * One message for the admin: who sent it, when, and what the page knew, as
 * lines. The page they wrote from (You, Settings) is left out of "Before"; the
 * site's build is its time (SvelteKit's `version`), shown as a date.
 */
export function feedbackView(
	row: {
		id: number;
		email: string;
		firstName: string | null;
		lastName: string | null;
		message: string;
		page: string | null;
		trail: string[];
		errors: string[];
		siteVersion: string | null;
		appVersion: number | null;
		appChannel: string | null;
		userAgent: string | null;
		viewport: string | null;
		createdAt: number;
		doneAt: number | null;
	},
	tz: string
): FeedbackView {
	const w = t().feedback.admin;
	const lines: string[] = [];
	if (row.page) lines.push(w.page(row.page));
	// The pages before the one they mean, newest last; the page they wrote from is the trail's end.
	const at = row.page === null ? -1 : row.trail.lastIndexOf(row.page);
	const before = at > 0 ? row.trail.slice(Math.max(0, at - 3), at) : [];
	if (before.length) lines.push(w.trail(before.join(' → ')));
	const device = deviceLine(row.userAgent);
	const where =
		row.appVersion !== null
			? w.app(row.appVersion, row.appChannel === 'play' ? ' (Play)' : '')
			: w.inBrowser;
	lines.push([where, device].filter(Boolean).join(' · '));
	if (row.viewport) lines.push(w.window(row.viewport));
	const built = row.siteVersion === null ? NaN : Number(row.siteVersion);
	if (Number.isFinite(built) && built > 0) lines.push(w.site(whenLabel(built, tz)));
	return {
		id: row.id,
		who: fullName(row),
		email: row.email,
		message: row.message,
		sent: w.sent(whenLabel(row.createdAt, tz)),
		lines,
		errors: row.errors,
		userAgent: row.userAgent,
		done: row.doneAt !== null
	};
}
