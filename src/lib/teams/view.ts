/** What the group screens say. PURE and client-safe. */
import { localDay } from '$lib/day/day';
import { byteSize, classDayLabel, dayMonth } from '$lib/format';
import { t } from '$lib/i18n/catalog';
import { TEAM_PURGE_MS } from '$lib/limits';
import type { Role } from '$lib/types';
import type { Level } from '$lib/levels/levels';

export function roleLabel(role: Role): string {
	return t().groups.role[role];
}

export function peopleLine(n: number): string {
	return t().entry.classes.people(n);
}

export function joinQuestion(name: string): string {
	return t().entry.classes.joinQuestion(name);
}

/** `adminFirst` null: the admin has no first name ("the admin"). */
export function noAccountLine(adminFirst: string | null): string {
	return t().entry.classes.noAccount(adminFirst);
}

/** "Salsa Tuesdays is being deleted on 2 Dec": the simple lesson page shows it too. */
const deletingLead = (name: string, day: string) => t().lesson.deleting(name, day);

export function deletingLine(name: string, day: string): string {
	return `${deletingLead(name, day)} · ${t().clones.makeMine}`;
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
	return { tone: 'warning', text, action: t().clones.makeMine };
}

/** The band's line under a group's people count. */
export function youLine(role: Role): string {
	return t().groups.you[role];
}

/** The pill on a group in the list: how many of its lessons and songs are new. */
export function newPill(n: number): string | null {
	return n > 0 ? t().groups.newPill(n) : null;
}

/**
 * The Groups tab's accessible name: it says so when something is new. `label` is
 * the tab's own name (`tabsFor`: Groups, or My class, or You); Groups says what is
 * new, the others "something new".
 */
export function groupsTabLabel(isNew: boolean, label?: string): string {
	const w = t();
	const name = label ?? w.shell.tabs.groups;
	if (!isNew) return name;
	return name === w.shell.tabs.groups ? w.groups.tabNew : name + w.entry.classes.somethingNew;
}

export function limitLine(n: number): string {
	return t().groups.list.limit(n);
}

/** New group's and Rename's refusal: composed inside the request, in the reader's language. */
export const nameRefusal = (): string => t().groups.list.nameRefusal;

/** The link a group's code makes. */
export function codeLink(origin: string, code: string): string {
	return `${origin}/g/${code}`;
}

/** The group page's storage line: "Uses 120 MB of 600 MB". */
export function groupUsesLine(used: number, limit: number): string {
	return t().groups.page.uses(byteSize(used), byteSize(limit));
}

/** The group page's songs heading: "Class songs · 3". */
export function classSongsHeading(n: number): string {
	const w = t().entry.classes;
	return n > 0 ? w.songsCount(n) : w.songs;
}

/**
 * My class's words (levels spec, "My class"): the tab's list, the class page, its menu.
 * Getters, so each read is in the reader's language (the name stays: many group pages read it).
 */
export const MY_CLASS = {
	get title(): string {
		return t().shell.tabs.myClass;
	},
	get classes(): string {
		return t().entry.classes.classes;
	},
	get earlier(): string {
		return t().entry.classes.earlier;
	},
	get menu(): string {
		return t().entry.classes.menu;
	},
	/** The desktop's empty pane beside a list of two or more classes. */
	get pick(): { title: string; body: string } {
		return t().entry.classes.pick;
	}
};

/** The toast after a one-tap Add in My class; its action is Undo. */
export const addedToToday = (): string => t().groups.page.addedToToday;

/**
 * My class: the newest published class (the big card) and the rest, newest
 * first (Earlier classes). Drafts are no class yet. Two on one day: the one
 * made later first, as the lists order them.
 */
export function latestAndEarlier<
	T extends { id: number; lessonDay: string; publishedAt: number | null }
>(lessons: T[]): { latest: T | null; earlier: T[] } {
	const published = lessons
		.filter((l) => l.publishedAt !== null)
		.sort((a, b) => b.lessonDay.localeCompare(a.lessonDay) || b.id - a.id);
	return { latest: published[0] ?? null, earlier: published.slice(1) };
}

/** A class's line in My class: "2 videos · 4 to practise", a zero part left out; null with neither. */
export function classMeta(videos: number, practise: number): string | null {
	const w = t().entry.classes;
	const parts = [
		videos > 0 ? w.videos(videos) : null,
		practise > 0 ? w.toPractise(practise) : null
	].filter((p) => p !== null);
	return parts.length > 0 ? parts.join(' · ') : null;
}

/** A row of the group menu, in the order drawn. */
export type GroupMenuItem = 'people' | 'deleted' | 'code' | 'rename' | 'leave' | 'delete';

/**
 * A live group's menu. My class's Class menu (`simple`) is People and Leave
 * only; otherwise the code and Recently deleted for those who edit, Rename and
 * Delete for the owner, Leave for everyone else.
 */
export function groupMenu(role: Role, simple: boolean): GroupMenuItem[] {
	if (simple) return ['people', 'leave'];
	const owner = role === 'owner';
	const edits = role !== 'member';
	const items: (GroupMenuItem | false)[] = [
		'people',
		edits && 'deleted',
		edits && 'code',
		owner && 'rename',
		!owner && 'leave',
		owner && 'delete'
	];
	return items.filter((i) => i !== false);
}

/**
 * At Follow my class, whether `teamId` is the person's one live class in this
 * dance: then it is the tab's own page, whatever their role (no ‹, whose
 * fallback, the tab, would open it again), and a lesson of theirs opens with no
 * list column beside it.
 */
export function onlyClass(
	level: Level,
	teams: { id: number; deletedAt: number | null }[],
	teamId: number | null
): boolean {
	if (level !== 'follow') return false;
	const live = teams.filter((t) => t.deletedAt === null);
	return live.length === 1 && live[0].id === teamId;
}

/** A class in the list of classes: when it last met ("Last class Tue 3 Nov"). */
export function lastClassLine(day: string | null, today: string): string {
	const w = t().entry.classes;
	return day === null ? w.noClasses : w.lastClass(classDayLabel(day, today));
}

/** The desktop's empty pane beside the Groups list, with no group open. */
export const PICK_GROUP = {
	get title(): string {
		return t().groups.list.pick.title;
	},
	get body(): string {
		return t().groups.list.pick.body;
	}
};

/**
 * The group code dialog's button. The desktop copies the link and says so (a
 * desktop browser's share sheet is not what Copy link says); the phone shares,
 * and copies where it cannot share.
 */
export function codeAction(
	desk: boolean,
	canShare: boolean,
	copied: boolean
): { label: string; icon: 'share' | 'copy'; copy: boolean } {
	const w = t().groups.code;
	if (desk) return { label: copied ? w.copied : w.copyLink, icon: 'copy', copy: true };
	return { label: copied ? w.copied : w.share, icon: 'share', copy: !canShare };
}

/** Under the code dialog's button when the desktop's copy fails: the link is selected instead. */
export const copyFailed = (): string => t().groups.code.copyFailed;
