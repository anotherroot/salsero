/** What the group screens say. PURE and client-safe. */
import { localDay } from '$lib/day/day';
import { byteSize, dayMonth, plural } from '$lib/format';
import { TEAM_PURGE_MS } from '$lib/limits';
import type { CopySummary, Role } from '$lib/types';

export function roleLabel(role: Role): string {
	return role === 'owner' ? 'Owner' : role === 'editor' ? 'Editor' : 'Member';
}

export function peopleLine(n: number): string {
	return plural(n, 'person', 'people');
}

export function joinQuestion(name: string): string {
	return `Join ${name}?`;
}

export function noAccountLine(adminFirst: string): string {
	return `This code only adds people who already have an account. Ask ${adminFirst} for an invite.`;
}

export const MAKE_COPY = 'Make my own copy';

const deletingLead = (name: string, day: string) => `${name} is being deleted on ${day}`;

export function deletingLine(name: string, day: string): string {
	return `${deletingLead(name, day)} · ${MAKE_COPY}`;
}

/** A former member's line on a group lesson they had added: still current, never theirs to edit. */
export function leftLine(team: string): string {
	return `You left ${team} · read-only`;
}

/** The day a group deleted at `deletedAt` goes for good, in the person's zone: "2 Dec". */
export function purgeDay(deletedAt: number, timezone: string): string {
	return dayMonth(localDay(deletedAt + TEAM_PURGE_MS, timezone));
}

/**
 * The banner on a group lesson for someone who is not in the live group: its
 * group is being deleted (everyone, the owner too, until the purge), or they
 * left or were removed. Its action is always Make my own copy, so `text` is
 * the line before it (`deletingLine` is `text · action`). Null for a member
 * of a live group.
 */
export function lessonNotice(
	team: { name: string; deletedAt: number | null },
	member: boolean,
	timezone: string
): { tone: 'info' | 'warning'; text: string; action: string } | null {
	if (team.deletedAt !== null) {
		const text = deletingLead(team.name, purgeDay(team.deletedAt, timezone));
		return { tone: 'warning', text, action: MAKE_COPY };
	}
	return member ? null : { tone: 'info', text: leftLine(team.name), action: MAKE_COPY };
}

/** The band's line under a group's people count. */
export function youLine(role: Role): string {
	return role === 'owner' ? 'you own it' : role === 'editor' ? 'you edit it' : 'you are a member';
}

/** The pill on a group in the list: how many of its lessons and songs are new. */
export function newPill(n: number): string | null {
	return n > 0 ? `${n} new` : null;
}

/** The Groups tab's accessible name: it says so when something is new. */
export function groupsTabLabel(isNew: boolean): string {
	return isNew ? 'Groups, new in your groups' : 'Groups';
}

export function limitLine(n: number): string {
	return `You can make ${plural(n, 'group', 'groups')}. Ask the admin for more.`;
}

export const NAME_REFUSAL = 'Give it a name of up to 60 characters that none of your groups has.';

/** The link a group's code makes. */
export function codeLink(origin: string, code: string): string {
	return `${origin}/g/${code}`;
}

/** The group page's storage line: "Uses 120 MB of 600 MB". */
export function groupUsesLine(used: number, limit: number): string {
	return `Uses ${byteSize(used)} of ${byteSize(limit)}`;
}

/** The lesson menu's line: "Make my own copy · uses 380 MB of your space". */
export function copyLine(bytes: number): string {
	return `${MAKE_COPY} · uses ${byteSize(bytes)} of your space`;
}

/** What a copy brings, a line each; a kind it has none of is left out. */
export function copyItems(c: CopySummary): string[] {
	const out = ['The lesson, its notes and links'];
	if (c.videos > 0) out.push(`${plural(c.videos, 'video', 'videos')} and their sections`);
	if (c.variations > 0) out.push(plural(c.variations, 'variation', 'variations'));
	if (c.routines > 0) out.push(plural(c.routines, 'routine', 'routines'));
	if (c.drills > 0) out.push(plural(c.drills, 'drill', 'drills'));
	return out;
}

/** Under the list: what stays behind, and that the copy is the person's for good. */
export const COPY_NOTE =
	'Yours to edit, and it stays if the group deletes the lesson. Figure recordings are not copied, and your practice stays on the group’s lesson.';

/** The group page's songs heading: "Class songs · 3". */
export function classSongsHeading(n: number): string {
	return n > 0 ? `Class songs · ${n}` : 'Class songs';
}
