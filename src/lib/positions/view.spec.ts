import { describe, expect, it } from 'vitest';
import type { PositionListRow } from '$lib/types';
import { EMPTY_HOLD } from './hold';
import * as v from './view';

const label = (t: string | null) => (t === null ? 'Other' : t[0].toUpperCase() + t.slice(1));
const row = (o: Partial<PositionListRow>): PositionListRow => ({
	id: 1,
	name: 'x',
	styleTag: 'salsa',
	hold: EMPTY_HOLD,
	teamId: null,
	archived: false,
	inCount: 0,
	outCount: 0,
	deadEnd: false,
	orphan: false,
	island: false,
	unused: false,
	from: null,
	twins: false,
	...o
});

describe('positions view', () => {
	it('taggedLine', () => {
		expect(v.taggedLine({ done: 31, total: 41 })).toBe('31 of 41 figures have positions.');
	});
	it('OPTIONAL_LINE', () => {
		expect(v.OPTIONAL_LINE).toBe(
			'Positions are optional: a figure without one fits anywhere in a routine.'
		);
	});
	it('rowMeta', () => {
		expect(v.rowMeta(row({ inCount: 17, outCount: 12 }), label)).toEqual({
			text: 'Salsa · 17 in · 12 out',
			word: null,
			tone: null
		});
		expect(v.rowMeta(row({ styleTag: 'timba', inCount: 2, deadEnd: true }), label)).toEqual({
			text: 'Timba · 2 in ·',
			word: 'dead end',
			tone: 'danger'
		});
		expect(v.rowMeta(row({ styleTag: 'timba', unused: true }), label)).toEqual({
			text: 'Timba · unused',
			word: null,
			tone: null
		});
		expect(v.rowMeta(row({ styleTag: null, outCount: 1, orphan: true }), label)).toEqual({
			text: 'Other · 1 out ·',
			word: 'orphan',
			tone: 'danger'
		});
		expect(
			v.rowMeta(row({ styleTag: null, inCount: 1, outCount: 2, island: true }), label)
		).toEqual({ text: 'Other · 1 in · 2 out ·', word: 'island', tone: null });
	});
	it('groupRowMeta', () => {
		expect(v.groupRowMeta(row({ from: 'Week 6' }), label)).toBe('Salsa · from Week 6');
		expect(v.groupRowMeta(row({}), label)).toBe('Salsa');
	});
	it('noPositionRow', () => {
		expect(v.noPositionRow(10)).toEqual({
			title: 'No position',
			meta: '10 figures · they fit anywhere'
		});
		expect(v.noPositionRow(1).meta).toBe('1 figure · they fit anywhere');
	});
	it('noPositionHead', () => {
		expect(v.noPositionHead({ none: 7, onlyStart: 1, onlyEnd: 2 })).toBe(
			'10 figures · 7 with none, 3 with only a start or an end'
		);
	});
	it('FITS_ANYWHERE', () => {
		expect(v.FITS_ANYWHERE).toEqual({
			title: 'Fits anywhere',
			body: 'A figure with no position can follow anything and lead into anything: the routine editor offers it everywhere and never marks a break for it.'
		});
	});
	it('noPositionGroups', () => {
		expect(v.noPositionGroups({ none: [1, 2], onlyStart: [3], onlyEnd: [4, 5, 6] })).toEqual([
			{ title: 'No start and no end · 2', ids: [1, 2] },
			{ title: 'Only an end · 3', ids: [4, 5, 6] },
			{ title: 'Only a start · 1', ids: [3] }
		]);
		expect(v.noPositionGroups({ none: [], onlyStart: [], onlyEnd: [9] })).toEqual([
			{ title: 'Only an end · 1', ids: [9] }
		]);
	});
	it('noPositionTag, noPositionMeta and NO_POSITION_EMPTY', () => {
		expect(v.noPositionTag('end', ['Manos cruzadas'])).toBe('ends in Manos cruzadas');
		expect(v.noPositionTag('start', ['Sombrero', 'Cerrada'])).toBe('starts in Sombrero, Cerrada');
		expect(v.noPositionMeta('Salsa', { startCount: 1, lengthCounts: 8, recordings: 1 })).toBe(
			'Salsa · starts on 1 · 8 counts · 1 recording'
		);
		expect(v.noPositionMeta('Son', { startCount: null, lengthCounts: null, recordings: 0 })).toBe(
			'Son'
		);
		expect(v.NO_POSITION_EMPTY).toBe('Every figure has a position on both sides.');
	});
	it('EMPTY and firstRunBody', () => {
		expect(v.EMPTY).toEqual({
			title: 'No positions yet',
			body: 'Start from a template’s rough positions, or make your own.'
		});
		expect(v.firstRunBody(41)).toBe(
			'Your 41 figures have none, and that is fine: they fit anywhere. Add positions when you want routines checked for what can follow what.'
		);
	});
	it('GROUP_NOTE', () => {
		expect(v.GROUP_NOTE).toBe(
			'The group’s own positions. Its figures can only be tagged with these.'
		);
	});
	it('positionSubtitle', () => {
		const p = row({});
		expect(v.positionSubtitle(p, { ins: 4, outs: 3 })).toBe('Position · 4 in · 3 out');
		expect(v.positionSubtitle(p, { ins: 2, outs: 0 })).toBe('Position · 2 in · 0 out');
		expect(v.positionSubtitle(p, { teamName: 'Salsa Tuesdays', ins: 3, outs: 3 })).toBe(
			'Salsa Tuesdays’ position · 3 in · 3 out'
		);
		expect(v.positionSubtitle(p, { teamName: 'Club', ins: 1, outs: 1 })).toBe(
			'Club’s position · 1 in · 1 out'
		);
		// A capital S and stray spaces are still a final s.
		expect(v.positionSubtitle(p, { teamName: 'CLASS ', ins: 1, outs: 1 })).toBe(
			'CLASS’ position · 1 in · 1 out'
		);
		expect(v.positionFromLessonNote('Week 6', ' SALSA TUESDAYS ')).toBe(
			'From Week 6. Tag your figures with it as it is; it stays SALSA TUESDAYS’.'
		);
	});
	it('holdChips is re-exported', () => {
		expect(v.holdChips({ hands: 'two', crossed: true, facing: 'face', frame: 'open' })).toEqual([
			'Two hands',
			'Crossed, right on top',
			'Face to face',
			'Open'
		]);
	});
	it('fromMeta and intoMeta: where each figure ends or starts, never its type', () => {
		expect(v.fromMeta({ ends: ['Abierta (dos manos), Salsa'] })).toBe(
			'Ends in Abierta (dos manos), Salsa'
		);
		expect(v.fromMeta({ ends: ['A', 'B'] })).toBe('Ends in A or B');
		expect(v.fromMeta({ ends: [] })).toBe('');
		expect(v.intoMeta({ starts: ['Cerrada'] })).toBe('From Cerrada');
		expect(v.intoMeta({ starts: ['Manos cruzadas', 'Cerrada'] })).toBe(
			'From Manos cruzadas or Cerrada'
		);
		// A figure with no start (it fits anywhere) still ends here: no dangling "from".
		expect(v.intoMeta({ starts: [] })).toBe('');
	});
	it('deadEnd', () => {
		expect(v.deadEnd('Caída', 2)).toEqual({
			title: 'Dead end',
			body: 'Two figures end in Caída and nothing you know leaves it. A routine that gets here stops.',
			action: 'New figure from Caída'
		});
		expect(v.deadEnd('Caída', 1).body).toBe(
			'One figure ends in Caída and nothing you know leaves it. A routine that gets here stops.'
		);
	});
	it('orphan', () => {
		expect(v.orphan('Espalda con espalda', 1)).toEqual({
			title: 'Orphan',
			body: 'One figure leaves Espalda con espalda and nothing you know ends in it.',
			action: 'New figure into Espalda con espalda'
		});
		expect(v.orphan('X', 3).body).toBe('Three figures leave X and nothing you know ends in it.');
	});
	it('throughMeta', () => {
		expect(v.throughMeta([[2, 3]])).toBe('Slots 2 → 3');
		expect(
			v.throughMeta([
				[5, 6],
				[9, 10]
			])
		).toBe('Slots 5 → 6 and 9 → 10');
		expect(
			v.throughMeta([
				[1, 2],
				[5, 6],
				[9, 10]
			])
		).toBe('Slots 1 → 2, 5 → 6 and 9 → 10');
	});
	it('pointLabel', () => {
		expect(v.pointLabel(72_000)).toBe('Point at 1:12');
		expect(v.pointLabel(5_400)).toBe('Point at 0:05');
	});
	it('HOW', () => {
		expect(v.HOW.example).toEqual([
			['Cerrada', 'Dile que no', 'Abierta'],
			['', 'Enchufla', 'Abierta']
		]);
		expect(v.HOW.sections.map((s) => s.title)).toEqual([
			'What is a position?',
			'Why tag figures with them?',
			'Types',
			'Optional',
			'Where to start'
		]);
		expect(v.HOW.sections[0].body).toBe(
			'How the two of you hold each other between figures: open with two hands, closed, crossed hands, a hammerlock, side by side.'
		);
		expect(v.HOW.sections[1].body).toBe(
			'Every figure starts in a position and ends in one. That tells the app what can follow what: the routine editor offers only what fits, and the map shows where you get stuck.'
		);
		expect(v.HOW.sections[2].body).toBe(
			'Give each one a type, the same as a figure’s: Salsa, Son, Timba. When you tag a figure, positions of its type come first; a figure can still go from one type to another.'
		);
		expect(v.HOW.sections[3].body).toBe(
			'A figure has no position until you give it one, and then it fits anywhere: the routine editor checks nothing for it. Use positions if they help you; leave them out if they don’t.'
		);
		expect(v.HOW.sections[4].body).toBe(
			'Add a template’s rough positions and rename or change them as you go, or make your own. Groups have their own, like figures, and you can copy them.'
		);
		expect(v.HOW.done).toBe('Got it');
	});
	it('templatesNote and addLabel', () => {
		expect(v.templatesNote('Son')).toBe(
			'Rough positions to start from: rename, change or remove them later. They get the type Son. What you already have by name is skipped.'
		);
		expect(v.addLabel(3)).toBe('Add 3 positions');
		expect(v.addLabel(1)).toBe('Add 1 position');
	});
	it('tags words', () => {
		expect(v.tagsEmpty).toBe('No position · fits anywhere');
		expect(v.TAGS_HELP).toBe(
			'Any number of each. In a routine, the next figure fits when it starts in any of these ends.'
		);
	});
	it('handholds', () => {
		expect(
			v.handholds(['Abierta (dos manos)', 'Manos cruzadas'], ['Abierta (una mano)', 'Candado'])
		).toEqual({
			from: 'Abierta (dos manos) or Manos cruzadas',
			to: 'Abierta (una mano) or Candado'
		});
		expect(v.handholds([], [])).toEqual({ from: 'No position', to: 'No position' });
	});
	it('holdsLine: a sibling’s handholds on one line', () => {
		expect(v.holdsLine(['Cerrada', 'Manos cruzadas'], ['Caída'])).toBe(
			'Cerrada or Manos cruzadas → Caída'
		);
		expect(v.holdsLine(['Cerrada'], [])).toBe('Cerrada → No position');
		expect(v.holdsLine([], ['Caída'])).toBe('No position → Caída');
		expect(v.holdsLine([], [])).toBe('No position');
	});
});

describe('the list’s heading, rows and chips', () => {
	it('heads the person’s own as Yours, a group’s by count', () => {
		expect(v.listHeading(15, false)).toBe('Yours · 15');
		expect(v.listHeading(5, true)).toBe('5 positions');
		expect(v.listHeading(1, true)).toBe('1 position');
		expect(v.MAP_ROW).toBe('The map');
		expect(v.NO_MATCH).toBe('No positions match');
		expect(v.NONE_OWN).toBe('No positions of your own yet.');
		expect(v.HOW_EXAMPLE_LABEL).toBe('A position, a figure, the next position');
	});
	it('labels a type, an untyped one as Other', () => {
		const l = v.styleLabelOf({ salsa: 'Salsa', dominican: 'Dominican' });
		expect([l('salsa'), l('dominican'), l(null), l('gone')]).toEqual([
			'Salsa',
			'Dominican',
			'Other',
			'gone'
		]);
	});

	const types = ['salsa', 'son', 'other'];
	const labels: Record<string, string> = { salsa: 'Salsa', son: 'Son', other: 'Other' };
	const opts = (o: Partial<v.PositionChipsOf> = {}): v.PositionChipsOf => ({
		types,
		typeLabel: labels,
		gaps: 4,
		groupMode: false,
		hasOwn: true,
		untyped: false,
		...o
	});
	it('is All, a chip per type, then Gaps with its count', () => {
		const chips = v.positionChips({ q: '' }, opts());
		expect(chips.map((c) => [c.label, c.count, c.on])).toEqual([
			['All', undefined, true],
			['Salsa', undefined, false],
			['Son', undefined, false],
			['Other', undefined, false],
			['Gaps', 4, false]
		]);
	});
	it('has no Gaps in group mode', () => {
		expect(
			v.positionChips({ q: '' }, opts({ gaps: 0, groupMode: true })).map((c) => c.label)
		).toEqual(['All', 'Salsa', 'Son', 'Other']);
	});
	it('has no Gaps without positions of your own (only a group’s), unless it is on', () => {
		expect(
			v.positionChips({ q: '' }, opts({ gaps: 0, hasOwn: false })).map((c) => c.label)
		).toEqual(['All', 'Salsa', 'Son', 'Other']);
		expect(
			v
				.positionChips({ q: '', gaps: '1' }, opts({ gaps: 0, hasOwn: false }))
				.map((c) => [c.label, c.on])
		).toEqual([
			['All', false],
			['Salsa', false],
			['Son', false],
			['Other', false],
			['Gaps', true]
		]);
	});
	it('adds Other for untyped rows when the dance has no such type (bachata)', () => {
		const bachata = {
			types: ['dominican', 'sensual'],
			typeLabel: { dominican: 'Dominican', sensual: 'Sensual' }
		};
		expect(v.positionChips({ q: '' }, opts(bachata)).map((c) => c.label)).toEqual([
			'All',
			'Dominican',
			'Sensual',
			'Gaps'
		]);
		const chips = v.positionChips({ q: '' }, opts({ ...bachata, untyped: true }));
		expect(chips.map((c) => [c.key, c.label])).toEqual([
			['all', 'All'],
			['type:dominican', 'Dominican'],
			['type:sensual', 'Sensual'],
			['type:other', 'Other'],
			['gaps', 'Gaps']
		]);
		expect(v.positionQuery({ q: '' }, chips[3].change)).toBe('type=other');
		// On, it stays even when nothing untyped is left to show.
		const on = v.positionChips({ q: '', type: 'other' }, opts(bachata));
		expect(on.find((c) => c.key === 'type:other')?.on).toBe(true);
		// Salsa has a type of its own called Other: never a second chip.
		expect(
			v.positionChips({ q: '' }, opts({ untyped: true })).filter((c) => c.label === 'Other')
		).toHaveLength(1);
	});
	it('orders group sections by group name, then id', () => {
		const g = (id: number, name: string) => ({ team: { id, name }, rows: [] });
		expect(
			[g(3, 'Rueda club'), g(1, 'Salsa Tuesdays'), g(2, 'Cubana'), g(0, 'Rueda club')]
				.sort(v.byGroupName)
				.map((x) => x.team.id)
		).toEqual([2, 0, 3, 1]);
	});
	it('lights the type on, toggles it off, and keeps the search', () => {
		const f = { q: 'ca', type: 'son', gaps: '1' as const };
		const chips = v.positionChips(f, opts({ gaps: 2 }));
		const son = chips.find((c) => c.label === 'Son')!;
		expect([son.on, chips[0].on, chips.at(-1)!.on]).toEqual([true, false, true]);
		expect(v.positionQuery(f, son.change)).toBe('q=ca&gaps=1');
		expect(v.positionQuery(f, chips[1].change)).toBe('q=ca&type=salsa&gaps=1');
		expect(v.positionQuery(f, chips[0].change)).toBe('q=ca');
		expect(v.positionQuery(f, chips.at(-1)!.change)).toBe('q=ca&type=son');
		expect(v.positionQuery({ q: '' }, { q: 'Cerrada ab' })).toBe('q=Cerrada%20ab');
		expect(v.positionQuery({ q: '' }, {})).toBe('');
	});
});

describe('words that were in the screens', () => {
	it('names the fields and their hints', () => {
		expect(v.FIELDS).toEqual({
			name: 'Name',
			namePlaceholder: 'e.g. Cerrada, Manos cruzadas',
			type: 'Type',
			hands: 'Hands',
			crossed: 'Crossed',
			facing: 'Facing',
			frame: 'Frame',
			notes: 'Notes',
			notesPlaceholder: 'How the hands meet, where the weight is…'
		});
	});
	it('says what failed, and what is busy, for a screen reader', () => {
		expect(v.SHEET_FAILED).toEqual({
			save: 'That did not save. Try again.',
			archive: 'That did not archive. Try again.',
			templates: 'Those were not added. Try again.'
		});
		expect(v.BUSY).toEqual({
			adding: 'Adding position',
			addingMany: 'Adding positions',
			saving: 'Saving',
			archiving: 'Archiving position'
		});
		expect(v.TEMPLATE_PICK).toBe('Template');
	});
	it('names what an Unlink takes from where', () => {
		expect(v.unlinkLabel('Point at 1:12', 'Manos cruzadas')).toBe(
			'Unlink Point at 1:12 from Manos cruzadas'
		);
		expect(v.unlinkLabel('Manos cruzadas', 'Week 6')).toBe('Unlink Manos cruzadas from Week 6');
	});
	it('words the page’s link refusals', () => {
		expect(v.LINK_REFUSED).toEqual({
			pickSpot: 'Pick a section or point.',
			pickLesson: 'Pick a lesson.',
			linkGone: 'That link was already removed.',
			lessonArchived: 'That lesson is archived.',
			already: 'Already linked.',
			lessonGone: 'That lesson was already unlinked.'
		});
		expect(v.notLinked('Week 6')).toBe('Week 6 could not be linked.');
	});
});

describe('the position sheet’s words', () => {
	it('names New and Edit, their footers and the archive note', () => {
		expect(v.SHEET.newTitle).toBe('New position');
		expect(v.SHEET.newSub).toBe('Type starts as your “New figures” type (Settings)');
		expect(v.SHEET.add).toBe('Add position');
		expect(v.SHEET.save).toBe('Save');
		expect(v.editTitle('Manos cruzadas')).toBe('Edit Manos cruzadas');
		expect(v.SHEET.typeHelp).toBe('One, the same list as a figure’s type.');
		expect(v.SHEET.crossed).toBe('Right hands on top');
		expect(v.SHEET.archive).toBe('Archive position');
		expect([v.SHEET.picture, v.SHEET.change, v.SHEET.pictureLegend]).toEqual([
			'Picture',
			'Change',
			'Its points'
		]);
		expect(v.SHEET.archiveBody).toBe(
			'Archived like a figure: Restore brings it back. Its figures lose it and, with no other, have no position.'
		);
		expect(v.pictureLine('Week 6 · Setenta into Sombrero, video 1', 72_400)).toBe(
			'From Week 6 · Setenta into Sombrero, video 1 at 1:12'
		);
		const lesson = { kind: 'lesson', lessonId: 1, title: 'Week 6', lessonDay: '2026-11-03' };
		expect(v.spotVideoLabel({ owner: { lessonVideoId: 1 }, src: '', from: lesson } as never)).toBe(
			'Week 6'
		);
		expect(
			v.spotVideoLabel({
				owner: { recordingId: 1 },
				src: '',
				from: { kind: 'recording', figure: 'Kentucky · Doble' }
			})
		).toBe('Recording · Kentucky · Doble');
	});
	it('names the empty state’s buttons and the template sheet', () => {
		expect(v.EMPTY_ACTIONS).toEqual({
			templates: 'Start from a template',
			create: 'New position',
			how: 'How positions work'
		});
		expect(v.TEMPLATES_TITLE).toBe('Start from a template');
		expect(v.YOU_HAVE_IT).toBe('You have it');
		expect(v.TEMPLATES_BUTTON).toBe('Templates');
	});
});

describe('a position’s page', () => {
	it('names a group’s figure by its group', () => {
		expect(v.fromMeta({ team: 'Salsa Tuesdays', ends: ['Abierta (dos manos)'] })).toBe(
			'Salsa Tuesdays’ · ends in Abierta (dos manos)'
		);
		expect(v.fromMeta({ team: 'Club', ends: [] })).toBe('Club’s');
		expect(v.intoMeta({ starts: ['Cerrada'], team: 'Salsa Tuesdays' })).toBe(
			'Salsa Tuesdays’ · from Cerrada'
		);
		expect(v.intoMeta({ starts: ['Cerrada'], team: null })).toBe('From Cerrada');
	});

	it('leads the subtitle with where a copy came from', () => {
		const p = {
			id: 1,
			name: 'Manos cruzadas',
			styleTag: 'son',
			hold: EMPTY_HOLD,
			teamId: null,
			archived: false
		};
		expect(
			v.positionSubtitle(p, { lead: 'Your copy · from Salsa Tuesdays', ins: 4, outs: 3 })
		).toBe('Your copy · from Salsa Tuesdays · 4 in · 3 out');
	});

	it('says where a group’s position came from, and what Edit does', () => {
		expect(v.positionFromLessonNote('Week 6', 'Salsa Tuesdays')).toBe(
			'From Week 6. Tag your figures with it as it is; it stays Salsa Tuesdays’.'
		);
		expect(v.MAKE_MINE_NOTE).toBe(
			'Edit makes it yours (Make it mine); your figures tagged with it move over.'
		);
	});

	it('the card of three rows: counts, and an empty one says None and does not open', () => {
		expect(v.relationRows({ from: 10, into: 0, routines: 1 })).toEqual([
			{ key: 'from', label: 'Figures from here', count: '10', opens: true },
			{ key: 'into', label: 'Figures into here', count: 'None', opens: false },
			{ key: 'routines', label: 'In routines', count: '1', opens: true }
		]);
		expect(v.relationTitle('from', 10)).toBe('Figures from here');
		expect(v.relationTitle('into', 1)).toBe('Figures into here');
		expect(v.relationTitle('routines', 1)).toBe('In 1 routine');
		expect(v.relationTitle('routines', 3)).toBe('In 3 routines');
		expect(v.newFigureLabel('from', 'Cerrada')).toBe('New figure from Cerrada');
		expect(v.newFigureLabel('into', 'Cerrada')).toBe('New figure into Cerrada');
	});

	it('the page’s own ⋯ items, each only where its href is given', () => {
		const all = v.positionMenuItems({
			name: 'Cerrada',
			newFrom: '/f?new=1&start=3',
			newInto: '/f?new=1&end=3',
			mapHref: '/map?pick=3',
			historyHref: '/h'
		});
		expect(all.map((i) => [i.key, i.label, i.meta ?? null, i.href])).toEqual([
			['newFrom', 'New figure from here', 'Starts in Cerrada', '/f?new=1&start=3'],
			['newInto', 'New figure into here', 'Ends in Cerrada', '/f?new=1&end=3'],
			['map', 'Show on the map', null, '/map?pick=3'],
			['history', 'History', null, '/h']
		]);
		expect(
			v
				.positionMenuItems({
					name: 'Cerrada',
					newFrom: null,
					newInto: null,
					mapHref: '/map?pick=3',
					historyHref: null
				})
				.map((i) => i.key)
		).toEqual(['map']);
	});

	it('names a point card’s video, and says when it is the picture', () => {
		expect(v.pointMeta('Week 6 · Setenta into Sombrero', true)).toBe(
			'Week 6 · Setenta into Sombrero · the picture'
		);
		expect(v.pointMeta('Recording · Kentucky · Doble', false)).toBe('Recording · Kentucky · Doble');
	});

	it('words the archived banner', () => {
		expect(v.ARCHIVED).toEqual({
			title: 'Archived',
			body: 'Its figures no longer show it. Restore brings it back.',
			restore: 'Restore'
		});
	});

	it('words New move from a position', () => {
		expect(v.presetLine({ side: 'start', name: 'Caída' })).toBe('Starts in Caída');
		expect(v.presetLine({ side: 'end', name: 'Caída' })).toBe('Ends in Caída');
		expect(v.PRESET_GONE).toBe(
			'That position can no longer tag a figure here. Add the move without it.'
		);
	});
});

describe('the map', () => {
	it('mapTwinsLine: who a twinned node stands for, each by its place', () => {
		expect(
			v.mapTwinsLine([
				{ name: 'Cerrada', team: null },
				{ name: 'Closed', team: { id: 1, name: 'Salsa Tuesdays' } },
				{ name: 'Closed', team: { id: 2, name: 'Rueda club' } }
			])
		).toBe('Twins: your Cerrada, Salsa Tuesdays’ Closed, Rueda club’s Closed');
	});
});

describe("a position's Video and Lessons", () => {
	const lessonVideo = {
		owner: { lessonVideoId: 3 },
		src: '/lesson-videos/w6.mp4',
		from: { kind: 'lesson' as const, lessonId: 7, title: 'Week 6', lessonDay: '2026-11-03' }
	};
	const recording = {
		owner: { recordingId: 4 },
		src: '/recordings/k.mp4',
		from: { kind: 'recording' as const, figure: 'Kentucky · Doble' }
	};
	const spot = (id: number, startMs: number, endMs: number | null, label: string | null) => ({
		id,
		startMs,
		endMs,
		label,
		linkedTo: [],
		linked: false
	});

	it('titles and openers', () => {
		expect(v.recordingsTitle(3)).toBe('Recordings · 3');
		expect(v.recordingsTitle(0)).toBe('Recordings');
		expect(v.lessonsTitle(2)).toBe('Lessons · 2');
		expect(v.lessonsTitle(0)).toBe('Lessons');
		expect(v.ADD_SPOT).toEqual({ label: 'Add', aria: 'Add a section or point to Recordings' });
		expect(v.LINK_LESSON).toEqual({ label: 'Link', aria: 'Link a lesson' });
		expect(v.linkSpotsTitle('Manos cruzadas')).toBe('Link to Manos cruzadas');
		expect(v.linkSpotsSub(null)).toBe('Sections and points of your lessons and recordings');
		expect(v.linkSpotsSub('Salsa Tuesdays')).toBe(
			'Sections and points of Salsa Tuesdays’ lessons and recordings'
		);
		expect(v.LINK_SPOTS.search).toBe('Search lessons, recordings, sections');
		expect(v.LINK_SPOTS.note).toBe(
			'A section loops; a point is one moment, and can be the picture.'
		);
		expect(v.lessonPickTitle('Manos cruzadas')).toBe('Lessons with Manos cruzadas');
		expect(v.LESSON_PICK.sub).toBe('A lesson linked here shows the position on its page too');
		expect(v.LESSON_PICK.search).toBe('Search lessons');
	});

	it('videoKey: a lesson video and a recording apart', () => {
		expect(v.videoKey(lessonVideo.owner)).toBe('v3');
		expect(v.videoKey(recording.owner)).toBe('r4');
	});

	it('spotGroupTitle: a lesson video by its number, a recording by its day (the board)', () => {
		expect(v.spotGroupTitle(lessonVideo, { n: 2 })).toBe('Week 6 · video 2');
		expect(v.spotGroupTitle(recording, { day: '2026-10-26' })).toBe(
			'Kentucky · Doble · recording 26 Oct'
		);
		// Without its place: the picture line's words.
		expect(v.spotGroupTitle(lessonVideo, undefined)).toBe('Week 6');
		expect(v.spotGroupTitle(recording, undefined)).toBe('Recording · Kentucky · Doble');
	});

	it('spotPickGroups: a group per video, sections and points worded apart', () => {
		const groups = v.spotPickGroups(
			[
				{
					video: lessonVideo,
					taughtHere: true,
					sections: [
						{ ...spot(1, 72_000, 91_000, 'The cross on 7'), linked: true },
						spot(2, 72_000, null, null),
						spot(3, 42_000, 65_500, null),
						spot(4, 15_000, null, 'Hands meet')
					]
				},
				{
					video: recording,
					taughtHere: false,
					sections: [spot(5, 8_000, 20_000, 'Into the cross')]
				}
			],
			{ v3: { n: 1 }, r4: { day: '2026-10-26' } }
		);
		expect(groups.map((g) => g.title)).toEqual([
			'Week 6 · video 1',
			'Kentucky · Doble · recording 26 Oct'
		]);
		expect(groups[0].entries).toEqual([
			{
				key: 'spot:1',
				value: 1,
				label: 'The cross on 7',
				meta: 'Section · 1:12.0–1:31.0',
				keywords: '1:12.0–1:31.0 Week 6 · video 1',
				linked: true,
				preview: true
			},
			{
				key: 'spot:2',
				value: 2,
				label: 'Point at 1:12',
				meta: 'Point',
				keywords: '1:12.0 Week 6 · video 1',
				linked: false,
				preview: false
			},
			{
				key: 'spot:3',
				value: 3,
				label: '0:42.0–1:05.5',
				meta: 'Section, no name',
				keywords: '0:42.0–1:05.5 Week 6 · video 1',
				linked: false,
				preview: true
			},
			{
				key: 'spot:4',
				value: 4,
				label: 'Hands meet',
				meta: 'Point at 0:15',
				keywords: '0:15.0 Week 6 · video 1',
				linked: false,
				preview: false
			}
		]);
		expect(groups[1].entries).toMatchObject([
			{
				key: 'spot:5',
				label: 'Into the cross',
				keywords: '0:08.0–0:20.0 Kentucky · Doble · recording 26 Oct'
			}
		]);
	});

	it("lessonMeta: a group's lesson by its group and day; a person's by its full day", () => {
		expect(v.lessonMeta({ teamName: 'Salsa Tuesdays', lessonDay: '2026-11-03' })).toBe(
			'Salsa Tuesdays · 3 Nov'
		);
		expect(v.lessonMeta({ teamName: null, lessonDay: '2026-10-13' })).toBe('Tuesday 13 October');
	});

	it('lessonPickGroups: month groups, a reaching lesson linked and said so', () => {
		const groups = v.lessonPickGroups(
			[
				{
					id: 1,
					title: 'Week 6 · Setenta into Sombrero',
					lessonDay: '2026-11-03',
					videos: 1,
					team: 'Salsa Tuesdays',
					linked: true,
					via: true
				},
				{
					id: 2,
					title: 'Week 3 · Enchufla',
					lessonDay: '2026-11-04',
					videos: 0,
					team: null,
					linked: false,
					via: false
				},
				{
					id: 3,
					title: 'Wednesday class',
					lessonDay: '2026-10-28',
					videos: 2,
					team: null,
					linked: false,
					via: false
				},
				{
					id: 4,
					title: 'Cubana class',
					lessonDay: '2026-10-13',
					videos: 1,
					team: null,
					linked: true,
					via: false
				},
				{
					id: 5,
					title: 'Last winter',
					lessonDay: '2025-12-02',
					videos: 1,
					team: null,
					linked: false,
					via: false
				}
			],
			'2026-11-04'
		);
		expect(groups.map((g) => g.title)).toEqual(['November', 'October', 'December 2025']);
		// Another year's lesson says its year, as Today's class days do.
		expect(groups[2].entries).toMatchObject([{ key: 'lesson:5', meta: 'Tue 2 Dec 2025' }]);
		expect(groups[0].entries).toEqual([
			{
				key: 'lesson:1',
				value: 1,
				label: 'Week 6 · Setenta into Sombrero',
				meta: 'Salsa Tuesdays · Tue 3 Nov · through a section',
				linked: true
			},
			{ key: 'lesson:2', value: 2, label: 'Week 3 · Enchufla', meta: 'Wed 4 Nov', linked: false }
		]);
		expect(groups[1].entries).toEqual([
			{
				key: 'lesson:3',
				value: 3,
				label: 'Wednesday class',
				meta: 'Wed 28 Oct · 2 videos',
				linked: false
			},
			{ key: 'lesson:4', value: 4, label: 'Cubana class', meta: 'Tue 13 Oct', linked: true }
		]);
	});

	it('withoutPreset: the figures list with New move’s params gone, the filter kept', () => {
		const at = (s: string) => new URL(`http://x/salsa/figures${s}`);
		expect(v.withoutPreset(at('?new=1&start=4'))).toBe('/salsa/figures');
		expect(v.withoutPreset(at('?q=en&new=1&end=4&style=son'))).toBe(
			'/salsa/figures?q=en&style=son'
		);
		expect(v.withoutPreset(at('?new=1'))).toBe('/salsa/figures');
		// Nothing to strip: no navigation at all.
		expect(v.withoutPreset(at('?q=en'))).toBeNull();
		expect(v.withoutPreset(at(''))).toBeNull();
	});

	it('unlinkFocus: where focus goes when the list has no row left to take it', () => {
		// An editor: the list's own Add or Link, then Edit.
		expect(v.unlinkFocus('spot', { canLink: true, canEditPosition: true })).toEqual([
			'link-spot',
			'edit-position',
			'recordings-heading',
			'relations'
		]);
		// A reader unlinking their own: no opener, no Edit; the list's heading, else the page's first.
		expect(v.unlinkFocus('lesson', { canLink: false, canEditPosition: false })).toEqual([
			'lessons-heading',
			'relations'
		]);
		expect(v.unlinkFocus('spot', { canLink: false, canEditPosition: false })).toEqual([
			'recordings-heading',
			'relations'
		]);
	});

	it('a point card that cannot play says why', () => {
		expect(v.POINT_PROBLEM.missing).toEqual({
			title: 'This file is missing',
			body: 'The server has no file for this video.'
		});
		expect(v.POINT_PROBLEM.unplayable.title).toBe('Can’t play here');
		expect(v.playFrom(72_400)).toBe('Play from 1:12');
	});
});
