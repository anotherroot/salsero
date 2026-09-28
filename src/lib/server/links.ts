import { and, asc, eq, type SQL } from 'drizzle-orm';
import type { Db } from './db';
import { appFlags, exercises, lessons, links } from './db/schema';
import { extractUrls, parseLink } from '$lib/links';
import type { LinkRow } from '$lib/types';

/** Who a link belongs to. Exactly one — the table's CHECK says the same. */
export type LinkOwner = { lessonId: number } | { figureId: number } | { exerciseId: number };

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const row = {
	id: links.id,
	url: links.url,
	title: links.title,
	createdAt: links.createdAt
};

function ownedBy(owner: LinkOwner): SQL {
	if ('lessonId' in owner) return eq(links.lessonId, owner.lessonId);
	if ('figureId' in owner) return eq(links.figureId, owner.figureId);
	return eq(links.exerciseId, owner.exerciseId);
}

export function listLinks(db: Db, owner: LinkOwner): LinkRow[] {
	return db
		.select(row)
		.from(links)
		.where(ownedBy(owner))
		.orderBy(asc(links.createdAt), asc(links.id))
		.all();
}

function insertLinks(tx: Tx, owner: LinkOwner, urls: string[], title: string | null): LinkRow[] {
	const have = new Set(
		tx
			.select({ url: links.url })
			.from(links)
			.where(ownedBy(owner))
			.all()
			.map((l) => l.url)
	);
	const fresh = urls
		.map((u) => u.trim())
		.filter((u, i, all) => parseLink(u) !== null && !have.has(u) && all.indexOf(u) === i);
	return fresh.map((url) =>
		tx
			.insert(links)
			.values({ ...owner, url, title: fresh.length === 1 ? title : null })
			.returning(row)
			.get()
	);
}

/**
 * Add links, skipping any the owner already has. Null when the owner is an
 * exercise that a figure, lesson or routine owns: that exercise shows its
 * OWNER's links, and a second place to attach one would make "where does this
 * link live?" unanswerable — the rule `lesson_exercises` follows for a figure's
 * exercise.
 */
export function addLinks(
	db: Db,
	owner: LinkOwner,
	urls: string[],
	title: string | null
): LinkRow[] | null {
	if ('exerciseId' in owner) {
		const ex = db
			.select({ source: exercises.source })
			.from(exercises)
			.where(eq(exercises.id, owner.exerciseId))
			.get();
		if (ex?.source !== 'custom') return null;
	}
	return db.transaction((tx) => insertLinks(tx, owner, urls, title));
}

/** Delete one link, only if it belongs to `owner` — so a posted id cannot reach another page's link. */
export function deleteLink(db: Db, owner: LinkOwner, id: number): boolean {
	return (
		db
			.delete(links)
			.where(and(eq(links.id, id), ownedBy(owner)))
			.run().changes > 0
	);
}

export const NOTE_LINKS_FLAG = 'lesson-note-links';

/**
 * Copy every URL typed into a lesson's notes into that lesson's links, ONCE
 * EVER. The marker row and the links go in one transaction, and the marker is
 * claimed first: if it was already there, nothing happens — so a link deleted
 * after the import stays deleted. The notes themselves are left alone; they
 * render linkified anyway.
 */
export function importNoteLinks(db: Db, now: number): number {
	return db.transaction((tx) => {
		const claimed = tx
			.insert(appFlags)
			.values({ key: NOTE_LINKS_FLAG, doneAt: now })
			.onConflictDoNothing()
			.run();
		if (claimed.changes === 0) return 0;
		let added = 0;
		for (const lesson of tx.select({ id: lessons.id, notes: lessons.notes }).from(lessons).all()) {
			if (!lesson.notes) continue;
			added += insertLinks(tx, { lessonId: lesson.id }, extractUrls(lesson.notes), null).length;
		}
		return added;
	});
}
