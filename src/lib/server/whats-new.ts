import { and, eq, inArray, isNull, isNotNull, sql } from 'drizzle-orm';
import type { Db } from './db';
import {
	lessonAdds,
	lessonExercises,
	lessonFigures,
	lessonRoutines,
	lessonVideos,
	lessons,
	opens,
	songs,
	spotLinks,
	teamMembers,
	teams,
	videoSpots
} from './db/schema';
import type { DanceSlug } from '$lib/dances/dances';

export type OpenKind = 'lesson' | 'song';

export type WhatsNew = {
	lessons: Set<number>;
	songs: Set<number>;
	/** New lessons and songs per team. */
	byTeam: Map<number, number>;
};

/** The person opened a group's lesson or song just now. */
export function recordOpen(
	db: Db,
	userId: string,
	kind: OpenKind,
	itemId: number,
	now: number
): void {
	db.insert(opens)
		.values({ userId, kind, itemId, openedAt: now })
		.onConflictDoUpdate({
			target: [opens.userId, opens.kind, opens.itemId],
			set: { openedAt: now }
		})
		.run();
}

/**
 * What is new to a person in their current groups of one dance, derived from
 * `opens`, never stored as unread. A lesson is new when it was published after
 * they joined and they have not opened it since; or, if they added it, when
 * something was linked to it after they last opened or added it. `opening` is
 * the item the current response opens, which must not count itself.
 *
 * A song is new when it is the group's, shared after they joined, not
 * deleted, and not opened since it was shared.
 */
export function whatsNew(
	db: Db,
	userId: string,
	dance: DanceSlug,
	opening?: { kind: OpenKind; id: number }
): WhatsNew {
	const result: WhatsNew = { lessons: new Set(), songs: new Set(), byTeam: new Map() };
	const member = db
		.select({ teamId: teamMembers.teamId, joinedAt: teamMembers.joinedAt })
		.from(teamMembers)
		.innerJoin(teams, eq(teams.id, teamMembers.teamId))
		.where(
			and(
				eq(teamMembers.userId, userId),
				eq(teams.dance, dance),
				isNull(teams.deletedAt),
				isNull(teams.purgedAt)
			)
		)
		.all();
	if (member.length === 0) return result;
	const joined = new Map(member.map((m) => [m.teamId, m.joinedAt]));
	const count = (teamId: number, id: number) => {
		if (opening?.kind === 'lesson' && opening.id === id) return;
		if (result.lessons.has(id)) return;
		result.lessons.add(id);
		result.byTeam.set(teamId, (result.byTeam.get(teamId) ?? 0) + 1);
	};

	// Published after joining and not opened since being published.
	const published = db
		.select({
			id: lessons.id,
			teamId: lessons.teamId,
			publishedAt: lessons.publishedAt,
			openedAt: opens.openedAt
		})
		.from(lessons)
		.leftJoin(
			opens,
			and(eq(opens.userId, userId), eq(opens.kind, 'lesson'), eq(opens.itemId, lessons.id))
		)
		.where(
			and(
				inArray(lessons.teamId, [...joined.keys()]),
				eq(lessons.dance, dance),
				isNotNull(lessons.publishedAt),
				isNull(lessons.archivedAt)
			)
		)
		.all();
	for (const l of published) {
		const at = l.publishedAt!;
		if (at > joined.get(l.teamId!)! && !(l.openedAt !== null && l.openedAt >= at)) {
			count(l.teamId!, l.id);
		}
	}

	// Added lessons: something linked after the last open or the add.
	const added = db
		.select({
			id: lessons.id,
			teamId: lessons.teamId,
			since: sql<number>`max(coalesce(${opens.openedAt}, 0), ${lessonAdds.addedAt})`
		})
		.from(lessonAdds)
		.innerJoin(lessons, eq(lessons.id, lessonAdds.lessonId))
		.leftJoin(
			opens,
			and(eq(opens.userId, userId), eq(opens.kind, 'lesson'), eq(opens.itemId, lessons.id))
		)
		.where(
			and(
				eq(lessonAdds.userId, userId),
				inArray(lessons.teamId, [...joined.keys()]),
				eq(lessons.dance, dance),
				isNotNull(lessons.publishedAt),
				isNull(lessons.archivedAt)
			)
		)
		.all();
	if (added.length > 0) {
		const since = new Map(added.map((a) => [a.id, a.since]));
		const ids = [...since.keys()];
		const arrivals = (rows: { lessonId: number; at: number }[]) => {
			for (const r of rows) {
				if (r.at > since.get(r.lessonId)!) {
					count(added.find((a) => a.id === r.lessonId)!.teamId!, r.lessonId);
				}
			}
		};
		const latest = (lessonId: unknown, at: unknown) => ({
			lessonId: lessonId as typeof lessonFigures.lessonId,
			at: sql<number>`max(${at})`
		});
		arrivals(
			db
				.select(latest(lessonFigures.lessonId, lessonFigures.createdAt))
				.from(lessonFigures)
				.where(inArray(lessonFigures.lessonId, ids))
				.groupBy(lessonFigures.lessonId)
				.all()
		);
		arrivals(
			db
				.select(latest(lessonRoutines.lessonId, lessonRoutines.createdAt))
				.from(lessonRoutines)
				.where(inArray(lessonRoutines.lessonId, ids))
				.groupBy(lessonRoutines.lessonId)
				.all()
		);
		arrivals(
			db
				.select(latest(lessonExercises.lessonId, lessonExercises.createdAt))
				.from(lessonExercises)
				.where(inArray(lessonExercises.lessonId, ids))
				.groupBy(lessonExercises.lessonId)
				.all()
		);
		arrivals(
			db
				.select({
					lessonId: lessonVideos.lessonId,
					at: sql<number>`max(${spotLinks.createdAt})`
				})
				.from(spotLinks)
				.innerJoin(videoSpots, eq(videoSpots.id, spotLinks.spotId))
				.innerJoin(lessonVideos, eq(lessonVideos.id, videoSpots.lessonVideoId))
				.where(inArray(lessonVideos.lessonId, ids))
				.groupBy(lessonVideos.lessonId)
				.all()
		);
	}

	// Shared after joining and not opened since being shared.
	const shared = db
		.select({
			id: songs.id,
			teamId: songs.teamId,
			sharedAt: songs.sharedAt,
			openedAt: opens.openedAt
		})
		.from(songs)
		.leftJoin(
			opens,
			and(eq(opens.userId, userId), eq(opens.kind, 'song'), eq(opens.itemId, songs.id))
		)
		.where(
			and(
				inArray(songs.teamId, [...joined.keys()]),
				eq(songs.dance, dance),
				isNotNull(songs.sharedAt),
				isNull(songs.archivedAt)
			)
		)
		.all();
	for (const s of shared) {
		const at = s.sharedAt!;
		if (opening?.kind === 'song' && opening.id === s.id) continue;
		if (at <= joined.get(s.teamId!)! || (s.openedAt !== null && s.openedAt >= at)) continue;
		result.songs.add(s.id);
		result.byTeam.set(s.teamId!, (result.byTeam.get(s.teamId!) ?? 0) + 1);
	}
	return result;
}
