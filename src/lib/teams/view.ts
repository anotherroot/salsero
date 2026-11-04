/** What the group screens say. PURE and client-safe. */
import { localDay } from '$lib/day/day';
import { byteSize, dayMonth, plural } from '$lib/format';
import { TEAM_PURGE_MS } from '$lib/limits';
import type { Role } from '$lib/types';
import { MAKE_MINE } from '$lib/clones/view';

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

const deletingLead = (name: string, day: string) => `${name} is being deleted on ${day}`;

export function deletingLine(name: string, day: string): string {
	return `${deletingLead(name, day)} · ${MAKE_MINE}`;
}

/** The day a group deleted at `deletedAt` goes for good, in the person's zone: "2 Dec". */
export function purgeDay(deletedAt: number, timezone: string): string {
	return dayMonth(localDay(deletedAt + TEAM_PURGE_MS, timezone));
}

/**
 * The banner on a group lesson whose group is being deleted, for everyone
 * who still reads it (the owner too) until the purge. Its action is always
 * Make it mine (ruling 12: once Make my own copy), so `text` is the line
 * before it (`deletingLine` is `text · action`). Null while the group
 * lives. Someone who left never sees the lesson at all: they read nothing
 * of the group.
 */
export function lessonNotice(
	team: { name: string; deletedAt: number | null },
	timezone: string
): { tone: 'warning'; text: string; action: string } | null {
	if (team.deletedAt === null) return null;
	const text = deletingLead(team.name, purgeDay(team.deletedAt, timezone));
	return { tone: 'warning', text, action: MAKE_MINE };
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

/** The group page's songs heading: "Class songs · 3". */
export function classSongsHeading(n: number): string {
	return n > 0 ? `Class songs · ${n}` : 'Class songs';
}
