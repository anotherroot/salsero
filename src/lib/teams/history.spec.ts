import { describe, expect, it } from 'vitest';
import {
	archivedByLine,
	canRestore,
	editedByLine,
	historyLine,
	historySubject,
	previousValue
} from './history';
import { withLocale } from '$lib/i18n/current';
import type { HistoryRow } from '$lib/types';

const names = new Map([
	['ana', 'Ana'],
	['luka', 'Luka']
]);

const row = (over: Partial<HistoryRow>): HistoryRow => ({
	id: 1,
	rootKind: 'lesson',
	rootId: 7,
	actorId: 'ana',
	at: 0,
	verb: 'change',
	subject: 'notes',
	subjectId: 7,
	before: null,
	after: null,
	trashId: null,
	...over
});

describe('historyLine', () => {
	it('reads the spec’s four examples', () => {
		expect(historyLine(row({ before: { notes: 'a' }, after: { notes: 'b' } }), names)).toBe(
			'Ana · changed the notes'
		);
		expect(
			historyLine(
				row({
					subject: 'section',
					subjectId: 3,
					before: { startMs: 10_000, label: 'Enchufla doble' },
					after: { startMs: 11_200, label: 'Enchufla doble' }
				}),
				names
			)
		).toBe("Ana · moved 'Enchufla doble' 1.2 s");
		expect(
			historyLine(row({ actorId: 'luka', verb: 'add', subject: 'section', subjectId: 3 }), names)
		).toBe('Luka · added a section');
		expect(historyLine(row({ verb: 'remove', subject: 'link', subjectId: 4 }), names)).toBe(
			'Ana · removed a link'
		);
	});

	it('says how far a move went either way, and an end on its own', () => {
		const move = (before: number, after: number, key = 'startMs') =>
			historyLine(
				row({ subject: 'section', before: { [key]: before }, after: { [key]: after } }),
				names
			);
		expect(move(5_000, 3_000)).toBe('Ana · moved a section 2 s');
		expect(move(5_000, 5_300, 'endMs')).toBe('Ana · moved the end of a section 0.3 s');
	});

	it('names a thing made, archived, published, and the routine’s own lines', () => {
		expect(historyLine(row({ verb: 'add', subject: 'lesson' }), names)).toBe(
			'Ana · made the lesson'
		);
		expect(historyLine(row({ verb: 'publish', subject: 'lesson' }), names)).toBe(
			'Ana · published the lesson'
		);
		expect(
			historyLine(
				row({
					rootKind: 'figure',
					verb: 'archive',
					subject: 'variation',
					before: { name: 'Doble' }
				}),
				names
			)
		).toBe("Ana · archived the figure 'Doble'");
		expect(
			historyLine(
				row({ verb: 'add', subject: 'figure', after: { name: 'Enchufla · Doble' } }),
				names
			)
		).toBe("Ana · added the figure 'Enchufla · Doble'");
		expect(
			historyLine(
				row({ rootKind: 'figure', verb: 'add', subject: 'figure', after: { name: 'Enchufla' } }),
				names
			)
		).toBe('Ana · made the move');
		expect(historySubject('figure', 'figure')).toBe('move');
		expect(historySubject('lesson', 'figure')).toBe('figure');
		expect(historySubject('lesson', 'variation')).toBe('figure');
		expect(historySubject('lesson', 'notes')).toBe('notes');
		expect(
			historyLine(
				row({ rootKind: 'routine', verb: 'remove', subject: 'slot', before: { count: 3 } }),
				names
			)
		).toBe('Ana · removed 3 slots');
		expect(historyLine(row({ rootKind: 'routine', subject: 'order' }), names)).toBe(
			'Ana · moved a slot'
		);
	});

	it('reads a group song’s lines', () => {
		const song = (over: Partial<HistoryRow>) =>
			historyLine(
				row({
					rootKind: 'song',
					subject: 'song',
					subjectId: null,
					after: { name: 'Chan Chan' },
					...over
				}),
				names
			);
		expect(song({ verb: 'add' })).toBe("Ana · added the song 'Chan Chan'");
		expect(song({ verb: 'share' })).toBe("Ana · shared the song 'Chan Chan' with the class");
		expect(song({ verb: 'unshare' })).toBe("Ana · stopped sharing the song 'Chan Chan'");
		expect(song({ verb: 'delete' })).toBe("Ana · deleted the song 'Chan Chan'");
		expect(song({ verb: 'restore' })).toBe("Ana · restored the song 'Chan Chan'");
		expect(song({ verb: 'edit', subject: 'anchors', after: { anchorsJson: '[0]' } })).toBe(
			'Ana · changed the count'
		);
		expect(song({ verb: 'edit', subject: 'tempoFactor' })).toBe('Ana · changed the tempo');
		expect(song({ verb: 'edit', subject: 'sampleStartS' })).toBe('Ana · changed the sample start');
		expect(song({ verb: 'edit', subject: 'title' })).toBe('Ana · changed the title');
		expect(song({ verb: 'edit', subject: 'song' })).toBe('Ana · changed the song');
		// A song's edit is not History's to put back.
		expect(
			canRestore(row({ rootKind: 'song', verb: 'edit', subject: 'title', before: { title: 'a' } }))
		).toBe(false);
	});

	it('reads someone with no name as Someone', () => {
		expect(historyLine(row({ actorId: 'gone' }), names)).toBe('Someone · changed the notes');
	});
});

describe('canRestore', () => {
	it('offers Restore on text and times only', () => {
		expect(canRestore(row({ before: { notes: 'a' }, after: { notes: 'b' } }))).toBe(true);
		expect(
			canRestore(
				row({
					subject: 'section',
					before: { startMs: 1, label: 'x' },
					after: { startMs: 2, label: 'x' }
				})
			)
		).toBe(true);
		expect(canRestore(row({ subject: 'partner', before: { partner: 'solo' } }))).toBe(false);
		expect(canRestore(row({ subject: 'order', before: { index: 1 } }))).toBe(false);
		expect(canRestore(row({ verb: 'add', subject: 'section' }))).toBe(false);
	});
});

describe('previousValue', () => {
	it('shows what text a change replaced, never a move', () => {
		expect(previousValue(row({ before: { notes: 'Bring water' }, after: { notes: '' } }))).toBe(
			'Bring water'
		);
		expect(previousValue(row({ before: { notes: null }, after: { notes: 'x' } }))).toBe('(empty)');
		expect(
			previousValue(row({ subject: 'section', before: { startMs: 1 }, after: { startMs: 2 } }))
		).toBeNull();
	});
});

describe('copy', () => {
	it('is the spec’s', () => {
		expect(editedByLine('Ana', '10 min ago')).toBe('Edited by Ana · 10 min ago');
		expect(archivedByLine('Ana')).toBe('Archived by Ana');
	});
});

describe('a take’s fields, in plain words', () => {
	it('names the practice, its tempo and the slots', () => {
		const one = (subject: string) =>
			historyLine(row({ rootKind: 'drill', subject, before: {}, after: {} }), names);
		expect(one('practiceMode')).toBe('Ana · changed the practice');
		expect(one('countBpm')).toBe('Ana · changed the practice tempo');
		expect(historyLine(row({ rootKind: 'routine', subject: 'slots' }), names)).toBe(
			'Ana · changed the slots'
		);
	});
});

describe('a position’s History', () => {
	const pos = (over: Partial<HistoryRow>) => row({ rootKind: 'position', ...over });
	it('words the hold fields', () => {
		const one = (subject: string) =>
			historyLine(pos({ subject, before: { [subject]: 'a' }, after: { [subject]: 'b' } }), names);
		expect(one('styleTag')).toBe('Ana · changed the type');
		expect(one('hands')).toBe('Ana · changed the hands');
		expect(one('crossed')).toBe('Ana · changed the crossed');
		expect(one('facing')).toBe('Ana · changed the facing');
		expect(one('frame')).toBe('Ana · changed the frame');
		expect(one('pictureSpotId')).toBe('Ana · changed the picture');
		expect(one('notes')).toBe('Ana · changed the notes');
		expect(one('name')).toBe('Ana · changed the name');
	});
	it('words made, several fields, archive and restore', () => {
		const line = (over: Partial<HistoryRow>) => historyLine(pos(over), names);
		expect(line({ verb: 'add', subject: 'position', after: { name: 'Cerrada' } })).toBe(
			'Ana · made the position'
		);
		expect(line({ verb: 'change', subject: 'position', before: {}, after: {} })).toBe(
			'Ana · changed the position'
		);
		expect(line({ verb: 'archive', subject: 'position' })).toBe('Ana · archived the position');
		expect(line({ verb: 'restore', subject: 'position', after: { name: 'Cerrada' } })).toBe(
			"Ana · restored the position 'Cerrada'"
		);
	});
	it('offers Restore on a name or notes change only', () => {
		expect(canRestore(pos({ subject: 'name', before: { name: 'a' }, after: { name: 'b' } }))).toBe(
			true
		);
		expect(
			canRestore(pos({ subject: 'hands', before: { hands: 'one' }, after: { hands: 'two' } }))
		).toBe(false);
	});
});

describe('a position link’s History', () => {
	const link = (verb: 'add' | 'remove', vals: Record<string, string | number | null>) =>
		row({
			rootKind: 'lesson',
			verb,
			subject: 'section-link',
			...(verb === 'add' ? { after: vals } : { before: vals })
		});
	it('says a point for a point, a section for a section, naming the position', () => {
		expect(historyLine(link('add', { name: 'Cerrada', point: 1 }), names)).toBe(
			"Ana · linked a point to 'Cerrada'"
		);
		expect(historyLine(link('remove', { name: 'Cerrada', point: 1 }), names)).toBe(
			"Ana · unlinked a point from 'Cerrada'"
		);
		expect(historyLine(link('add', { name: 'Cerrada' }), names)).toBe(
			"Ana · linked a section to 'Cerrada'"
		);
		expect(historyLine(link('remove', { name: 'Enchufla' }), names)).toBe(
			"Ana · unlinked a section from 'Enchufla'"
		);
	});
});

describe('old rows with raw ids', () => {
	it('shows startIds, endIds and endId values as they are, without crashing', () => {
		const old = (subject: string, before: unknown, after: unknown) =>
			historyLine(
				row({
					rootKind: 'figure',
					subject,
					before: { [subject]: before } as never,
					after: { [subject]: after } as never
				}),
				names
			);
		expect(old('startIds', '3,4', '3')).toBe('Ana · changed the start positions');
		expect(old('endIds', '[7]', '[7,9]')).toBe('Ana · changed the end positions');
		expect(old('endId', 7, null)).toBe('Ana · changed the end position');
		expect(
			previousValue(
				row({ subject: 'startIds', before: { startIds: '3,4' }, after: { startIds: '3' } })
			)
		).toBeNull();
	});
});

describe('History in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);
	const notes = row({ before: { notes: 'a' }, after: { notes: 'b' } });
	const section = (
		before: Record<string, number | string>,
		after: Record<string, number | string>
	) => row({ subject: 'section', subjectId: 3, before, after });

	it('reads the spec’s lines, a decimal comma in the seconds', () => {
		sl(() => {
			expect(historyLine(notes, names)).toBe('Ana · Spremenjeno: opombe');
			expect(
				historyLine(
					section(
						{ startMs: 10_000, label: 'Enchufla doble' },
						{ startMs: 11_200, label: 'Enchufla doble' }
					),
					names
				)
			).toBe('Ana · Premaknjeno: »Enchufla doble« za 1,2 s');
			expect(historyLine(section({ startMs: 5_000 }, { startMs: 3_000 }), names)).toBe(
				'Ana · Premaknjeno: odsek za 2 s'
			);
			expect(historyLine(section({ endMs: 5_000 }, { endMs: 5_300 }), names)).toBe(
				'Ana · Premaknjeno: konec odseka za 0,3 s'
			);
			expect(
				historyLine(row({ actorId: 'luka', verb: 'add', subject: 'section', subjectId: 3 }), names)
			).toBe('Luka · Dodano: odsek');
			expect(
				historyLine(
					row({
						rootKind: 'figure',
						verb: 'archive',
						subject: 'variation',
						before: { name: 'Doble' }
					}),
					names
				)
			).toBe('Ana · Arhivirano: različica »Doble«');
			expect(
				historyLine(
					row({ rootKind: 'figure', verb: 'add', subject: 'figure', after: { name: 'Enchufla' } }),
					names
				)
			).toBe('Ana · Ustvarjeno: figura');
		});
	});

	it('reads the other verbs, counts and someone gone', () => {
		sl(() => {
			const song = (over: Partial<HistoryRow>) =>
				historyLine(
					row({ rootKind: 'song', subject: 'song', after: { name: 'Chan Chan' }, ...over }),
					names
				);
			expect(song({ verb: 'add' })).toBe('Ana · Dodano: skladba »Chan Chan«');
			expect(song({ verb: 'share' })).toBe('Ana · Deljeno s tečajem: skladba »Chan Chan«');
			expect(song({ verb: 'unshare' })).toBe('Ana · Ni več deljeno s tečajem: skladba »Chan Chan«');
			expect(song({ verb: 'edit', subject: 'anchors' })).toBe('Ana · Spremenjeno: štetje');
			expect(historyLine(row({ verb: 'publish', subject: 'lesson' }), names)).toBe(
				'Ana · Objavljeno: lekcija'
			);
			const slots = (n: number, verb: 'add' | 'remove' | 'restore') =>
				historyLine(
					row({
						rootKind: 'routine',
						verb,
						subject: 'slot',
						...(verb === 'remove' ? { before: { count: n } } : { after: { count: n } })
					}),
					names
				);
			expect(slots(2, 'add')).toBe('Ana · Dodano: 2 mesti');
			expect(slots(3, 'remove')).toBe('Ana · Odstranjeno: 3 mesta');
			expect(slots(5, 'restore')).toBe('Ana · Vrnjeno: 5 mest');
			expect(slots(1, 'restore')).toBe('Ana · Vrnjeno: mesto');
			expect(historyLine(row({ rootKind: 'routine', subject: 'order' }), names)).toBe(
				'Ana · Premaknjeno: mesto'
			);
			expect(
				historyLine(
					row({
						rootKind: 'figure',
						verb: 'add',
						subject: 'variation',
						after: { name: 'Doble', from: 'Enchufla' }
					}),
					names
				)
			).toBe('Ana · Premaknjeno sem: »Doble« · prej: »Enchufla«');
			expect(
				historyLine(
					row({ verb: 'add', subject: 'section-link', after: { name: 'Cerrada', point: 1 } }),
					names
				)
			).toBe('Ana · Povezano: točka · »Cerrada«');
			expect(
				historyLine(
					row({ verb: 'remove', subject: 'section-link', before: { name: 'Enchufla' } }),
					names
				)
			).toBe('Ana · Povezava odstranjena: odsek · »Enchufla«');
			expect(historyLine(section({ label: 'a' }, { label: 'Vrtenje' }), names)).toBe(
				'Ana · Poimenovano: odsek »Vrtenje«'
			);
			expect(historyLine(row({ actorId: 'gone' }), names)).toBe('Nekdo · Spremenjeno: opombe');
			expect(historySubject('figure', 'figure')).toBe('figura');
			expect(historySubject('lesson', 'variation')).toBe('različica');
			expect(previousValue(row({ before: { notes: null }, after: { notes: 'x' } }))).toBe(
				'(prazno)'
			);
			expect(editedByLine('Ana', 'pred 10 min')).toBe('Zadnja sprememba: Ana · pred 10 min');
			expect(archivedByLine('Ana')).toBe('Arhivirano · Ana');
		});
	});

	it('composes one stored row in each reader’s language', () => {
		const moved = section(
			{ startMs: 10_000, label: 'Enchufla doble' },
			{ startMs: 11_200, label: 'Enchufla doble' }
		);
		expect(historyLine(moved, names)).toBe("Ana · moved 'Enchufla doble' 1.2 s");
		expect(sl(() => historyLine(moved, names))).toBe(
			'Ana · Premaknjeno: »Enchufla doble« za 1,2 s'
		);
		// And back: nothing about the row changed.
		expect(historyLine(moved, names)).toBe("Ana · moved 'Enchufla doble' 1.2 s");
		expect(moved.before).toEqual({ startMs: 10_000, label: 'Enchufla doble' });
	});
});
