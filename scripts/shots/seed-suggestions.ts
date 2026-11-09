/**
 * The rig's suggestions: a queue of the AI's actions in a COPY of a db, from
 * the admin's own rows (their real typos), through the app's own `propose` and
 * `runActions`. Used by the Suggestions scene (ext_suggestions.py), never .data.
 *
 *   SHOTS_SEED_DB=<copy> nix develop -c npx vitest run --config scripts/shots/seed.config.ts scripts/shots/seed-suggestions.ts
 */
import { it } from 'vitest';
import { sql } from 'drizzle-orm';
import { openDb } from '../../src/lib/server/db';
import { splitAccounts } from '../../src/lib/server/dance-split';
import { NO_FILES } from '../../src/lib/server/test-walls';
import { propose } from '../../src/lib/server/ai-queue/store';
import { runActions } from '../../src/lib/server/ai-queue/run';
import { queueOf } from '../../src/lib/server/ai-queue/store';
import type { Who } from '../../src/lib/server/ai-queue/kinds';
import { KINDS } from '../../src/lib/server/ai-queue/kinds';
import '../../src/lib/server/ai-queue/kinds/all';

it('seeds the suggestions', async () => {
	const path = process.env.SHOTS_SEED_DB;
	if (!path || path.includes('/.data/')) throw new Error('SHOTS_SEED_DB: a copy, never .data');
	const db = openDb(path);
	// What the app does at boot to an older copy: every account gets its dance.
	await splitAccounts(db, NO_FILES, Date.now());
	const one = <T>(q: ReturnType<typeof sql>) => db.get<T>(q);
	const admin = one<{ id: string; dance: string }>(
		sql`select id, dance from users where is_admin = 1 order by created_at limit 1`
	)!;
	// An older copy has no dance on its accounts yet: theirs is salsa.
	const who: Who = {
		userId: admin.id,
		dance: (admin.dance || 'salsa') as Who['dance'],
		grantId: null
	};
	const T = Date.now();
	const ok = (r: { ok: boolean; message?: string; actionId?: number }) => {
		if (!r.ok) throw new Error(r.message);
		return r.actionId!;
	};

	// Spelling: the real typos in this person's names and notes.
	const names: Record<string, unknown>[] = [];
	const spot = one<{ id: number }>(
		sql`select id from video_spots where label = 'Exchibela' limit 1`
	);
	if (spot) names.push({ kind: 'edit_section', section_id: spot.id, label: 'Exhibela' });
	const nad = one<{ id: number }>(
		sql`select id from lessons where title = 'Nadeljevalna' and user_id = ${admin.id} limit 1`
	);
	if (nad) names.push({ kind: 'edit_lesson', lesson_id: nad.id, title: 'Nadaljevalna' });
	const tes = one<{ id: number }>(
		sql`select id from routines where name = 'Tes tes' and user_id = ${admin.id} limit 1`
	);
	if (tes) names.push({ kind: 'edit_routine', routine_id: tes.id, name: 'Test' });
	// Only what this person may change in this copy.
	const mayDo = (l: Record<string, unknown>) => {
		const { kind, ...rest } = l as { kind: string };
		const p = KINDS[kind].parse(rest);
		return p.ok && KINDS[kind].prepare(db, who, p.args).ok;
	};
	names.splice(0, names.length, ...names.filter(mayDo));
	if (names.length)
		ok(
			propose(
				db,
				who,
				{
					group: { title: 'Pravopis' },
					title: `Tipkarske napake v ${names.length} imenih`,
					lines: names as never
				},
				T
			)
		);
	const groupId = queueOf(db, who.userId, who.dance, T)[0]?.id;
	const spelling = groupId ? { id: groupId } : { title: 'Pravopis' };

	const lesson = one<{ id: number; notes: string }>(
		sql`select id, notes from lessons where title = 'Salsa nadaljevalna' and user_id = ${admin.id} limit 1`
	);
	if (lesson?.notes)
		ok(
			propose(
				db,
				who,
				{
					group: spelling,
					title: 'Opombe: Salsa nadaljevalna',
					lines: [
						{
							kind: 'edit_lesson',
							lesson_id: lesson.id,
							notes: lesson.notes
								.replace('Ucili smos e', 'Učili smo se')
								.replace('bomj', 'bolj')
								.replace('Ucili smo se salsa', 'Učili smo se salsa')
						}
					] as never
				},
				T
			)
		);
	const fig = one<{ id: number; notes: string }>(
		sql`select id, notes from figures where notes like 'I dont remember%' and user_id = ${admin.id} limit 1`
	);
	let done = 0;
	if (fig)
		done = ok(
			propose(
				db,
				who,
				{
					group: spelling,
					title: 'Opomba figure',
					lines: [
						{
							kind: 'edit_figure',
							figure_id: fig.id,
							notes: "I don't remember it exactly.. just a test"
						}
					] as never
				},
				T
			)
		);

	// Sections: a new one on a lesson video, then linked to a figure (waits for it).
	const video = one<{ id: number }>(
		sql`select lv.id from lesson_videos lv join lessons l on l.id = lv.lesson_id where l.user_id = ${admin.id} limit 1`
	);
	const guapea = one<{ id: number }>(
		sql`select f.id from figures f join figure_groups g on g.id = f.group_id where g.name = 'Guapea' and f.user_id = ${admin.id} and f.archived_at is null limit 1`
	);
	if (video) {
		const sec = ok(
			propose(
				db,
				who,
				{
					group: { title: 'Odseki' },
					title: 'Nov odsek Guapea',
					lines: [
						{
							kind: 'add_section',
							lesson_video_id: video.id,
							start_ms: 31000,
							end_ms: 38000,
							label: 'Guapea'
						}
					] as never
				},
				T
			)
		);
		if (guapea)
			ok(
				propose(
					db,
					who,
					{
						group: { id: queueOf(db, who.userId, who.dance, T).at(-1)!.id },
						title: 'Poveži odsek z Guapeo',
						lines: [
							{ kind: 'link_section', section_id: { ref: sec }, figure_id: guapea.id }
						] as never
					},
					T
				)
			);
	}

	// Publish: a group draft the admin may publish.
	const draft = one<{ id: number }>(
		sql`select l.id from lessons l join team_members m on m.team_id = l.team_id and m.user_id = ${admin.id} and m.role in ('owner', 'editor') where l.published_at is null and l.archived_at is null limit 1`
	);
	if (draft)
		ok(
			propose(
				db,
				who,
				{
					group: { title: 'Objava' },
					title: 'Objavi lekcijo',
					lines: [{ kind: 'publish_lesson', lesson_id: draft.id }] as never
				},
				T
			)
		);

	// One already run, to show Done with Undo.
	if (done) {
		const v = Object.fromEntries(
			queueOf(db, who.userId, who.dance, T).flatMap((g) => g.actions.map((a) => [a.id, a.version]))
		);
		await runActions(db, who, [done], v, T);
	}
	console.log(
		'seeded suggestions:',
		queueOf(db, who.userId, who.dance, T).flatMap((g) =>
			g.actions.map((a) => `${g.title} / ${a.title}`)
		)
	);
});
