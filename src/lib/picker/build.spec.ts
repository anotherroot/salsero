import { describe, expect, it } from 'vitest';
import {
	exerciseGroups,
	figureRows,
	linkOptionGroups,
	routineRows,
	sectionGroups,
	variationEntries
} from './build';
import { frequencyLabel } from '$lib/frequency';
import { isHeading, shown, type PickGroup, type PickHeading, type PickRow } from './model';
import type {
	FigureVersion,
	LinkOption,
	LinkOptions,
	PickExercise,
	SectionGroup
} from '$lib/types';

const version = (id: number, groupId: number, figure: string, name: string): FigureVersion => ({
	id,
	groupId,
	figure,
	name,
	label: `${figure} · ${name}`
});

const exercise = (over: Partial<PickExercise> & { id: number; name: string }): PickExercise => ({
	source: 'custom',
	everyDays: 3,
	figure: null,
	variation: null,
	linked: false,
	...over
});

describe('variationEntries', () => {
	it('variationEntries: groups variations under their figure in input order, keys figure:{id}', () => {
		const entries = variationEntries([
			version(4, 2, 'Enchufla', 'Basic'),
			version(7, 2, 'Enchufla', 'Doble'),
			version(3, 1, 'Dile que no', 'Basic')
		]);
		expect(entries.map((e) => e.heading)).toEqual(['Enchufla', 'Dile que no']);
		expect(entries.every((e) => e.collapse)).toBe(true);
		expect(entries[0].rows).toEqual([
			{ key: 'figure:4', value: 4, label: 'Enchufla · Basic', short: 'Basic' },
			{ key: 'figure:7', value: 7, label: 'Enchufla · Doble', short: 'Doble' }
		]);
		expect(entries[1].rows.map((r) => r.key)).toEqual(['figure:3']);
	});

	it('variationEntries: carries linked', () => {
		const entries = variationEntries([
			{ ...version(4, 2, 'Enchufla', 'Basic'), linked: true },
			{ ...version(7, 2, 'Enchufla', 'Doble'), linked: false }
		]);
		expect(entries[0].rows.map((r) => r.linked)).toEqual([true, false]);
	});
});

describe('figureRows', () => {
	it('figureRows: meta is the variations joined with ", "', () => {
		expect(figureRows([{ id: 2, name: 'Enchufla', variations: ['Basic', 'Doble'] }])).toEqual([
			{ key: 'group:2', value: 2, label: 'Enchufla', meta: 'Basic, Doble' }
		]);
	});
});

describe('routineRows', () => {
	it('routineRows: "1 slot", "4 slots · loops"', () => {
		const rows = routineRows([
			{ id: 1, name: 'Warm-up loop', slots: 4, loops: true },
			{ id: 2, name: 'Enchufla combo', slots: 1, loops: false, linked: true }
		]);
		expect(rows).toEqual([
			{ key: 'routine:1', value: 1, label: 'Warm-up loop', meta: '4 slots · loops' },
			{ key: 'routine:2', value: 2, label: 'Enchufla combo', meta: '1 slot', linked: true }
		]);
	});
});

describe('exerciseGroups', () => {
	it('exerciseGroups: groups in the order Figures, Routines, Drills, Lessons, empty ones left out', () => {
		const all = exerciseGroups([
			exercise({ id: 1, name: 'Review: Tuesday', source: 'lesson' }),
			exercise({ id: 2, name: 'Spot turns', source: 'custom' }),
			exercise({ id: 3, name: 'Combo', source: 'routine' }),
			exercise({
				id: 4,
				name: 'Setenta · Complicado',
				source: 'figure',
				figure: 'Setenta',
				variation: 'Complicado'
			})
		]);
		expect(all.map((g) => g.title)).toEqual(['Figures', 'Routines', 'Drills', 'Lessons']);

		const some = exerciseGroups([
			exercise({ id: 2, name: 'Spot turns', source: 'custom' }),
			exercise({ id: 3, name: 'Combo', source: 'routine' })
		]);
		expect(some.map((g) => g.title)).toEqual(['Routines', 'Drills']);
		expect(exerciseGroups([])).toEqual([]);
	});

	it('exerciseGroups: a figure with one exercise collapses to "Setenta · Complicado"', () => {
		const groups = exerciseGroups([
			exercise({
				id: 4,
				name: 'Setenta · Complicado',
				source: 'figure',
				figure: 'Setenta',
				variation: 'Complicado'
			}),
			exercise({
				id: 5,
				name: 'Enchufla · Basic',
				source: 'figure',
				figure: 'Enchufla',
				variation: 'Basic'
			}),
			exercise({
				id: 6,
				name: 'Enchufla · Doble',
				source: 'figure',
				figure: 'Enchufla',
				variation: 'Doble'
			})
		]);
		const lines = shown(groups, '');
		const text = lines.map((l) =>
			l.kind === 'group'
				? `# ${l.title}`
				: l.kind === 'heading'
					? l.text
					: `${l.indent ? '  ' : ''}${l.text}`
		);
		expect(text).toEqual(['# Figures', 'Enchufla', '  Basic', '  Doble', 'Setenta · Complicado']);
		const setenta = lines.find((l) => l.kind === 'row' && l.text === 'Setenta · Complicado');
		expect(setenta?.kind === 'row' && setenta.row.key).toBe('exercise:4');
	});

	it('exerciseGroups: meta is frequencyLabel(everyDays)', () => {
		const [drills] = exerciseGroups([
			exercise({ id: 2, name: 'Spot turns', everyDays: 3, linked: true })
		]);
		const row = drills.entries[0];
		expect(isHeading(row)).toBe(false);
		expect((row as PickRow).meta).toBe('Every 3 days');
		expect((row as PickRow).linked).toBe(true);
	});
});

describe('sectionGroups', () => {
	const sec = (
		id: number,
		startMs: number,
		endMs: number | null,
		label: string | null,
		linkedTo: string[] = [],
		linked = false
	) => ({ id, startMs, endMs, label, linkedTo, linked });
	const lessonVideo = (
		id: number,
		title: string,
		taughtHere: boolean,
		sections: SectionGroup['sections']
	): SectionGroup => ({
		video: {
			owner: { lessonVideoId: id },
			src: `/lesson-videos/${id}.mp4`,
			from: { kind: 'lesson', lessonId: id, title, lessonDay: '2026-10-12' }
		},
		taughtHere,
		sections
	});
	const gs: SectionGroup[] = [
		lessonVideo(1, 'Cubana', true, [
			sec(2, 61000, 80000, null),
			sec(1, 12000, 34000, 'Enchufla doble')
		]),
		lessonVideo(2, 'Later', false, [sec(3, 0, 500, null, ['Enchufla · Doble'], true)])
	];
	const rowsOf = (g: PickGroup) => (g.entries[0] as PickHeading).rows;

	it('taught videos under the near title, the rest under Other videos, in input order', () => {
		const out = sectionGroups(gs, 'In this lesson');
		expect(out.map((g) => g.title)).toEqual(['In this lesson', 'Other videos']);
		expect(out[0].entries.map((e) => (isHeading(e) ? e.heading : e.label))).toEqual([
			'Cubana · 12 Oct 2026'
		]);
		expect(rowsOf(out[0]).map((r) => r.key)).toEqual(['spot:1', 'spot:2']);
		expect(rowsOf(out[0])[0]).toMatchObject({ value: 1, preview: true });
	});

	it('a video with one section keeps its heading', () => {
		const out = sectionGroups([gs[1]], 'In this lesson');
		expect(out.map((g) => g.title)).toEqual(['Other videos']);
		expect(out[0].entries[0]).toMatchObject({ heading: 'Later · 12 Oct 2026', collapse: false });
	});

	it('an unnamed section is found by its time', () => {
		const lines = shown(sectionGroups(gs, 'In this lesson'), '1:01');
		expect(JSON.stringify(lines)).toContain('spot:2');
		expect(JSON.stringify(lines)).not.toContain('spot:1');
	});

	it('meta shows \u2192 what it is linked to, and the time range when named', () => {
		const out = sectionGroups(gs, 'In this lesson');
		expect(rowsOf(out[0])[0].meta).toBe('0:12.0\u20130:34.0');
		expect(rowsOf(out[0])[1].meta).toBeUndefined();
		expect(rowsOf(out[1])[0].meta).toBe('\u2192 Enchufla \u00b7 Doble');
		expect(rowsOf(out[1])[0].linked).toBe(true);
	});
});

const lopt = (o: Partial<LinkOption> & { label: string }): LinkOption => ({
	target: { figureId: 1 },
	drill: false,
	figure: null,
	name: o.label,
	everyDays: null,
	linked: false,
	...o
});
const variation = (id: number, figure: string, name: string, linked = false): LinkOption =>
	lopt({ target: { figureId: id }, label: `${figure} · ${name}`, figure, name, linked });
const drillOpt = (id: number, name: string, everyDays = 3): LinkOption =>
	lopt({ target: { exerciseId: id }, label: name, drill: true, name, everyDays });
const linkOpts = (over: Partial<LinkOptions>): LinkOptions =>
	({ nearTitle: 'In this lesson', near: [], figures: [], drills: [], ...over }) as LinkOptions;

describe('linkOptionGroups', () => {
	it('linkOptionGroups: near, Figures, Drills in that order, near titled from nearTitle', () => {
		const groups = linkOptionGroups(
			linkOpts({
				nearTitle: 'This figure',
				near: [variation(4, 'Enchufla', 'Basic', true), drillOpt(9, 'Clave')],
				figures: [variation(3, 'Setenta', 'Basic')],
				drills: [drillOpt(8, 'Pasos')]
			})
		);
		expect(groups.map((g) => g.title)).toEqual(['This figure', 'Figures', 'Drills']);
		const near = groups[0].entries;
		expect(isHeading(near[0]) && near[0].heading).toBe('Enchufla');
		expect((near[0] as PickHeading).rows[0]).toMatchObject({ key: 'figure:4', linked: true });
		expect((near[1] as PickRow).key).toBe('exercise:9');
		expect((groups[1].entries[0] as PickHeading).rows[0].key).toBe('figure:3');
	});

	it('linkOptionGroups: a drill row carries how often', () => {
		const groups = linkOptionGroups(linkOpts({ drills: [drillOpt(8, 'Pasos', 7)] }));
		expect(groups).toHaveLength(1);
		expect(groups[0].entries[0]).toMatchObject({
			key: 'exercise:8',
			value: 8,
			label: 'Pasos',
			meta: frequencyLabel(7),
			linked: false
		});
	});
});
