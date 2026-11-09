import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import type { SectionLinkChip, ViaSection } from '$lib/types';
import {
	ADD_LABEL,
	DRAFT_BAND,
	publishItem,
	deleteBlock,
	deleteVideoBody,
	positionLinkLabel,
	positionMeta,
	positionPickGroups,
	exerciseMeta,
	figureMeta,
	lessonBandLine,
	practiceRows,
	whenOnToday,
	reviewMeta,
	routineMeta,
	sectionHeading,
	unlinkViaBody,
	unlinkViaTitle,
	viaBadge,
	viaRanges,
	yoursMeta
} from './page';

const via = (startMs: number, endMs: number): ViaSection => ({
	spotId: startMs,
	startMs,
	endMs,
	label: null
});
const chip = (label: string, archived = false): SectionLinkChip => ({ id: 1, label, archived });
const two = [via(72_000, 90_400), via(185_000, 202_800)];

describe('lesson page lines', () => {
	it('headings and badges', () => {
		expect(sectionHeading('Figures', 3)).toBe('Figures · 3');
		expect(sectionHeading('Exercises', 0)).toBe('Exercises');
		expect(viaBadge([])).toBeNull();
		expect(viaBadge([two[0]])).toBe('via section');
		expect(viaBadge(two)).toBe('via 2 sections');
		expect(viaRanges(two)).toBe('1:12.0–1:30.4, 3:05.0–3:22.8');
	});
	it('a point is said as a point', () => {
		const point = (startMs: number): ViaSection => ({
			spotId: startMs,
			startMs,
			endMs: null,
			label: null
		});
		expect(viaBadge([point(72_000)])).toBe('via point');
		expect(viaBadge([point(72_000), point(15_000)])).toBe('via 2 points');
		expect(viaBadge([point(72_000), two[0]])).toBe('via a section and a point');
		expect(viaBadge([point(72_000), ...two])).toBe('via 2 sections and a point');
		expect(unlinkViaTitle('Manos cruzadas', 'Week 6')).toBe('Unlink Manos cruzadas from Week 6?');
		expect(unlinkViaTitle('Enchufla · Doble')).toBe('Unlink Enchufla · Doble?');
		expect(unlinkViaBody('Manos cruzadas', [point(72_000)], 'Week 6')).toBe(
			'Manos cruzadas is on Week 6 through point 1:12.0. Unlink it from the lesson and the point?'
		);
		expect(unlinkViaBody('Manos cruzadas', [two[0], point(15_000)], 'Week 6')).toBe(
			'Manos cruzadas is on Week 6 through section and point 1:12.0–1:30.4, 0:15.0. Unlink it from the lesson and the section and point?'
		);
	});

	it('meta lines', () => {
		expect(figureMeta({ partner: 'partner', viaSections: two })).toBe(
			'1:12.0–1:30.4, 3:05.0–3:22.8'
		);
		expect(figureMeta({ partner: 'solo', viaSections: [] })).toBe('Solo');
		const today = '2026-10-31'; // a Saturday
		const state = { gap: 3, lastDay: '2026-10-28', dueDay: '2026-11-02' };
		expect(routineMeta(state, today)).toBe('Due Monday');
		expect(routineMeta(undefined, today)).toBeNull();
		expect(exerciseMeta({ viaSections: [] }, state, today)).toBe('Due Monday');
		expect(exerciseMeta({ viaSections: [] }, { ...state, dueDay: '2026-10-29' }, today)).toBe(
			'Due today'
		);
		expect(exerciseMeta({ viaSections: [] }, { ...state, lastDay: null }, today)).toBe('New');
		expect(exerciseMeta({ viaSections: two }, state, today)).toBe('1:12.0–1:30.4, 3:05.0–3:22.8');
		const label = (t: string | null) => (t === 'son' ? 'Son' : 'Salsa');
		expect(positionMeta({ styleTag: 'son', viaSections: [via(72000, 91000)] }, label)).toBe(
			'1:12.0–1:31.0 · Son'
		);
		expect(positionMeta({ styleTag: 'son', viaSections: [] }, label)).toBe('Son');
		expect(positionMeta({ styleTag: null, viaSections: [] }, label)).toBeNull();
		expect(reviewMeta({ active: true }, state, today)).toEqual([
			{ text: 'Due Monday', strong: false },
			{ text: 'review exercise', strong: false }
		]);
		expect(reviewMeta({ active: false }, { ...state, lastDay: null }, today)).toEqual([
			{ text: 'New', strong: false },
			{ text: 'inactive', strong: true },
			{ text: 'review exercise', strong: false }
		]);
	});

	it('dialog bodies', () => {
		expect(unlinkViaBody('Enchufla · Doble', [via(42_000, 65_500)])).toBe(
			'Enchufla · Doble is on this lesson through section 0:42.0–1:05.5. Unlink it from the lesson and the section?'
		);
		expect(unlinkViaBody('Setenta · Basic', two)).toBe(
			'Setenta · Basic is on this lesson through sections 1:12.0–1:30.4, 3:05.0–3:22.8. Unlink it from the lesson and the sections?'
		);
		expect(deleteVideoBody(3)).toBe(
			'Its 3 sections go with it. Lesson videos aren’t backed up, so this can’t be undone.'
		);
		expect(deleteVideoBody(1)).toBe(
			'Its 1 section goes with it. Lesson videos aren’t backed up, so this can’t be undone.'
		);
		expect(deleteVideoBody(0)).toBe('Lesson videos aren’t backed up, so this can’t be undone.');
	});

	it('positionPickGroups marks the linked rows, own types first and a group after', () => {
		const hold = { hands: null, crossed: null, facing: null, frame: null };
		const row = (
			id: number,
			name: string,
			linked: boolean,
			team: { id: number; name: string } | null
		) => ({
			id,
			name,
			styleTag: 'salsa',
			hold,
			teamId: team?.id ?? null,
			archived: false,
			linked,
			team
		});
		const groups = positionPickGroups(
			[
				row(1, 'Cerrada', true, null),
				row(2, 'Abierta', false, null),
				row(3, 'Sombra', true, { id: 9, name: 'Ana' })
			],
			(t) => (t === null ? 'Other' : 'Salsa')
		);
		expect(groups.map((g) => g.title)).toEqual(['Salsa', 'Ana’s']);
		const flat = groups
			.flatMap((g) => g.entries)
			.map((e) => ('rows' in e ? null : [e.label, e.linked]));
		expect(flat).toEqual([
			['Cerrada', true],
			['Abierta', false],
			['Sombra', true]
		]);
	});

	it('deleteBlock mirrors the server wording', () => {
		expect(deleteBlock([{ links: [] }, { links: [] }])).toBeNull();
		expect(
			deleteBlock([
				{ links: [chip('Footwork drill'), chip('Enchufla · Doble')] },
				{ links: [chip('Enchufla · Doble'), chip('Old drill', true)] }
			])
		).toBe('Linked to Enchufla · Doble, Footwork drill, Old drill (archived) — unlink it first.');
	});

	it('deleteBlock names the positions its sections and points link, as linksBlocking does', () => {
		expect(deleteBlock([{ links: [] }], [{ name: 'Cerrada', archived: false }])).toBe(
			'Linked to Position · Cerrada — unlink it first.'
		);
		expect(
			deleteBlock(
				[{ links: [chip('Enchufla · Doble')] }],
				[
					{ name: 'Vieja', archived: true },
					{ name: 'Cerrada', archived: false },
					{ name: 'Cerrada', archived: false }
				]
			)
		).toBe(
			'Linked to Enchufla · Doble, Position · Cerrada, Position · Vieja (archived) — unlink it first.'
		);
		expect(positionLinkLabel('Cerrada')).toBe('Position · Cerrada');
	});

	it('a point in a via list is its moment alone', () => {
		expect(
			viaRanges([{ spotId: 1, startMs: 72_000, endMs: null, label: null }, via(1000, 2000)])
		).toBe('1:12.0, 0:01.0–0:02.0');
	});
});

describe("the lists' + Add", () => {
	it('names what each one adds', () => {
		expect(ADD_LABEL).toEqual({
			figure: 'Add a figure',
			routine: 'Add a routine',
			exercise: 'Add an exercise',
			position: 'Add a position',
			link: 'Add a link'
		});
	});
});

describe("a draft's band", () => {
	it('says what a draft is and what Publish does', () => {
		expect(DRAFT_BAND).toEqual({
			title: 'Draft',
			line: "Members don't see it yet",
			publish: 'Publish'
		});
	});
});

describe('the simple lesson page', () => {
	// 2026-11-05 is a Thursday.
	const today = '2026-11-05';
	const due = (dueDay: string, lastDay: string | null = '2026-11-01') => ({
		gap: 3,
		lastDay,
		dueDay
	});

	it('the band says the class and its day; an own lesson its day alone', () => {
		expect(lessonBandLine('2026-11-03', today, true)).toBe('Class · Tue 3 Nov');
		expect(lessonBandLine('2025-11-04', today, true)).toBe('Class · Tue 4 Nov 2025');
		expect(lessonBandLine('2026-11-03', today, false)).toBe('Tue 3 Nov');
	});

	it('when each is next on Today, in the due words', () => {
		expect(whenOnToday(due('2026-11-02'), true, today)).toBe('On Today today');
		expect(whenOnToday(due(today), true, today)).toBe('On Today today');
		expect(whenOnToday(due('2026-11-06'), true, today)).toBe('On Today tomorrow');
		expect(whenOnToday(due('2026-11-08'), true, today)).toBe('On Today on Sunday');
		expect(whenOnToday(due('2026-11-11'), true, today)).toBe('On Today on Wednesday');
		expect(whenOnToday(due('2026-11-12'), true, today)).toBe('On Today next week');
		expect(whenOnToday(due('2026-11-18'), true, today)).toBe('On Today next week');
		expect(whenOnToday(due('2026-11-19'), true, today)).toBe('On Today on 19 Nov');
		expect(whenOnToday(due('2027-01-14'), true, today)).toBe('On Today on 14 Jan 2027');
		expect(whenOnToday(due(today), false, today)).toBe('Paused');
	});

	it("what you're practising: the person's live entries, in the page's order", () => {
		const rows = practiceRows(
			[
				{ id: 10, name: 'Salsa 3 Nov', kind: 'lesson', active: true },
				{ id: 11, name: 'Enchufla routine', kind: 'routine', active: true },
				{ id: 12, name: 'Footwork drill', kind: 'drill', active: false },
				// No schedule: archived, or not the person's own: not drawn.
				{ id: 13, name: 'Gone drill', kind: 'drill', active: true }
			],
			{ 10: due(today, null), 11: due('2026-11-08'), 12: due(today) },
			today
		);
		expect(rows).toEqual([
			{ id: 10, name: 'Go over this lesson', when: 'On Today today' },
			{ id: 11, name: 'Enchufla routine', when: 'On Today on Sunday' },
			{ id: 12, name: 'Footwork drill', when: 'Paused' }
		]);
		expect(practiceRows([], {}, today)).toEqual([]);
	});
});

describe("Publish in a draft's ⋯ menu", () => {
	it('names the group that will see it', () => {
		expect(publishItem('Salsa Tuesdays')).toEqual({
			key: 'publish',
			icon: 'upload',
			label: 'Publish',
			meta: 'Members of Salsa Tuesdays see it'
		});
	});
});

describe('the simple lesson page in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);
	// 2026-11-05 is a Thursday.
	const today = '2026-11-05';
	const due = (dueDay: string) => ({ gap: 3, lastDay: '2026-11-01', dueDay });

	it('the band says the lesson and its day', () => {
		expect(sl(() => lessonBandLine('2026-11-03', today, true))).toBe('Lekcija · tor, 3. nov.');
		expect(sl(() => lessonBandLine('2026-11-03', today, false))).toBe('tor, 3. nov.');
	});

	it('when each is next on Today: a weekday as a time', () => {
		const when = (day: string, active = true) => sl(() => whenOnToday(due(day), active, today));
		expect(when('2026-11-02')).toBe('Na vrsti danes');
		expect(when('2026-11-06')).toBe('Na vrsti jutri');
		expect(when('2026-11-08')).toBe('Na vrsti v nedeljo');
		expect(when('2026-11-11')).toBe('Na vrsti v sredo');
		expect(when('2026-11-12')).toBe('Na vrsti naslednji teden');
		expect(when('2026-11-19')).toBe('Na vrsti 19. nov.');
		expect(when('2027-01-14')).toBe('Na vrsti 14. jan. 2027');
		expect(when(today, false)).toBe('Na premoru');
	});

	it("the lesson's own entry", () => {
		const rows = sl(() =>
			practiceRows(
				[{ id: 10, name: 'Salsa 3 Nov', kind: 'lesson', active: true }],
				{
					10: due(today)
				},
				today
			)
		);
		expect(rows).toEqual([{ id: 10, name: 'Ponovite to lekcijo', when: 'Na vrsti danes' }]);
	});
});

describe('the full lesson page in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);
	const point = (startMs: number): ViaSection => ({
		spotId: startMs,
		startMs,
		endMs: null,
		label: null
	});
	const many = (n: number) => Array.from({ length: n }, (_, i) => via(i * 1000, i * 1000 + 500));

	it('the via badge: »prek« and a genitive', () => {
		expect(sl(() => viaBadge([two[0]]))).toBe('prek odseka');
		expect(sl(() => viaBadge(two))).toBe('prek 2 odsekov');
		expect(sl(() => viaBadge(many(5)))).toBe('prek 5 odsekov');
		expect(sl(() => viaBadge([point(72_000)]))).toBe('prek točke');
		expect(sl(() => viaBadge([point(72_000), point(15_000), point(1_000)]))).toBe('prek 3 točk');
		expect(sl(() => viaBadge([point(72_000), two[0]]))).toBe('prek odseka in točke');
		expect(sl(() => viaBadge([point(72_000), ...two]))).toBe('prek 2 odsekov in točke');
	});

	it('the unlink question: names in »…«, vikanje', () => {
		expect(sl(() => unlinkViaTitle('Manos cruzadas', 'Week 6'))).toBe(
			'Želite odstraniti »Manos cruzadas« z lekcije »Week 6«?'
		);
		expect(sl(() => unlinkViaTitle('Enchufla · Doble'))).toBe(
			'Želite odstraniti »Enchufla · Doble« z lekcije?'
		);
		expect(sl(() => unlinkViaBody('Enchufla · Doble', [via(42_000, 65_500)]))).toBe(
			'»Enchufla · Doble« je na tej lekciji prek odseka 0:42,0–1:05,5. Želite odstraniti povezavo z lekcijo in z odsekom?'
		);
		expect(sl(() => unlinkViaBody('Setenta · Basic', two))).toBe(
			'»Setenta · Basic« je na tej lekciji prek odsekov 1:12,0–1:30,4, 3:05,0–3:22,8. Želite odstraniti povezavo z lekcijo in z odsekoma?'
		);
		expect(sl(() => unlinkViaBody('Manos cruzadas', [two[0], point(15_000)], 'Week 6'))).toBe(
			'»Manos cruzadas« je na lekciji »Week 6« prek odseka in točke 1:12,0–1:30,4, 0:15,0. Želite odstraniti povezavo z lekcijo ter z odsekom in s točko?'
		);
		expect(sl(() => unlinkViaBody('Manos cruzadas', [point(1), point(2), point(3)]))).toContain(
			'prek točk'
		);
		expect(sl(() => unlinkViaBody('Manos cruzadas', [point(1), point(2), point(3)]))).toContain(
			'z lekcijo in s točkami?'
		);
	});

	it('the delete question: the sections agree with their count', () => {
		const tail = 'Za videe lekcij ni varnostne kopije, zato izbrisa ne boste mogli razveljaviti.';
		expect(sl(() => deleteVideoBody(0))).toBe(tail);
		expect(sl(() => deleteVideoBody(1))).toBe(`Z njim gre tudi 1 odsek. ${tail}`);
		expect(sl(() => deleteVideoBody(2))).toBe(`Z njim gresta tudi 2 odseka. ${tail}`);
		expect(sl(() => deleteVideoBody(3))).toBe(`Z njim gredo tudi 3 odseki. ${tail}`);
		expect(sl(() => deleteVideoBody(5))).toBe(`Z njim gre tudi 5 odsekov. ${tail}`);
		expect(sl(() => deleteVideoBody(102))).toBe(`Z njim gresta tudi 102 odseka. ${tail}`);
	});

	it('what blocks a delete, in the player’s words', () => {
		expect(
			sl(() =>
				deleteBlock(
					[{ links: [chip('Setenta · Basic'), chip('Old drill', true)] }],
					[{ name: 'Cerrada', archived: false }]
				)
			)
		).toBe(
			'Povezano: Old drill (arhivirano), Položaj · Cerrada, Setenta · Basic. Najprej odstranite povezavo.'
		);
		expect(sl(() => positionLinkLabel('Cerrada'))).toBe('Položaj · Cerrada');
	});

	it('the meta lines: Yours, paused, the review exercise', () => {
		const today = '2026-10-31';
		const state = { gap: 3, lastDay: '2026-10-28', dueDay: '2026-11-02' };
		expect(sl(() => figureMeta({ partner: 'partner', viaSections: [] }))).toBe('V paru');
		expect(sl(() => yoursMeta(null, 3))).toBe('Vaše');
		expect(sl(() => yoursMeta('1:12,0', 3))).toBe('Vaše · 1:12,0');
		expect(sl(() => reviewMeta({ active: false }, state, today)).map((p) => p.text)).toEqual([
			expect.any(String),
			'na premoru',
			'vaja za ponovitev'
		]);
	});

	it('the + Add, the draft band and Publish', () => {
		expect(sl(() => ({ ...ADD_LABEL }))).toEqual({
			figure: 'Dodaj figuro',
			routine: 'Dodaj kombinacijo',
			exercise: 'Dodaj vajo',
			position: 'Dodaj položaj',
			link: 'Dodaj povezavo'
		});
		expect(sl(() => ({ ...DRAFT_BAND }))).toEqual({
			title: 'Osnutek',
			line: 'Člani je še ne vidijo',
			publish: 'Objavi'
		});
		expect(sl(() => publishItem('Salsa Tuesdays'))).toMatchObject({
			label: 'Objavi',
			meta: 'Videli jo bodo člani skupine: Salsa Tuesdays'
		});
	});
});
