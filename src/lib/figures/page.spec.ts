import { describe, expect, it, vi } from 'vitest';
import type { ScheduleState } from '$lib/schedule/schedule';
import {
	addVideoRow,
	linkRowView,
	recordingsCount,
	figureMenuItems,
	archiveCopy,
	filterRows,
	recordingMetaLine,
	recordingsTitle,
	relationRows,
	relationTitle,
	showRecordings,
	sortRoutines,
	topVideo,
	deleteRecordingBody,
	figureSubtitle,
	lengthError,
	moveState,
	practiceLine,
	recordingDay,
	routineUseMeta,
	timingLine,
	variationNav
} from './page';

const TODAY = '2026-10-31'; // a Saturday
const st = (dueDay: string, lastDay: string | null): ScheduleState => ({
	gap: 3,
	lastDay,
	dueDay
});

describe('routineUseMeta', () => {
	it('names the slots', () => {
		expect(routineUseMeta({ slots: [3], slotCount: 6 })).toBe('Slot 3 of 6');
		expect(routineUseMeta({ slots: [2, 5], slotCount: 8 })).toBe('Slots 2 and 5 of 8');
		expect(routineUseMeta({ slots: [1, 4, 6], slotCount: 9 })).toBe('Slots 1, 4 and 6 of 9');
	});
});

describe('practiceLine', () => {
	it('never done is New', () =>
		expect(practiceLine(st(TODAY, null), TODAY, true)).toEqual({ text: 'New', tone: 'status' }));
	it('a set today', () =>
		expect(practiceLine(st('2026-11-03', TODAY), TODAY, false)).toEqual({
			text: 'Done today',
			tone: 'done'
		}));
	it('due this week names the day', () =>
		expect(practiceLine(st('2026-11-02', '2026-10-28'), TODAY, false)?.text).toBe('Due Monday'));
	it('past its day reads Due today, never late', () =>
		expect(practiceLine(st('2026-10-29', '2026-10-26'), TODAY, false)).toEqual({
			text: 'Due today',
			tone: null
		}));
	it('no state says nothing', () => expect(practiceLine(null, TODAY, false)).toBeNull());
	it('a paused exercise says so, not when it is due', () =>
		expect(practiceLine(st('2026-10-29', '2026-10-26'), TODAY, false, false)).toEqual({
			text: "Paused · not on Today's list",
			tone: null
		}));
	it('paused but done today is still Done today', () =>
		expect(practiceLine(st('2026-11-03', TODAY), TODAY, false, false)?.text).toBe('Done today'));
});

describe('timingLine', () => {
	it('names whole eights', () => {
		expect(timingLine(1, 16)).toEqual({ main: 'Starts on 1 · 16 counts', extra: ' · 2 eights' });
		expect(timingLine(1, 8).extra).toBe(' · one 8-count');
	});
	it('says nothing more when the length is not whole eights', () => {
		expect(timingLine(5, 4)).toEqual({ main: 'Starts on 5 · 4 counts', extra: '' });
		expect(timingLine(3, 12).extra).toBe('');
	});
});

describe('archiveCopy', () => {
	it('a figure among others', () =>
		expect(archiveCopy('Enchufla', 'Doble', false)).toEqual({
			title: 'Archive Doble?',
			button: 'Archive Doble',
			caption: 'Doble leaves Enchufla. Its recordings and practice history are kept.'
		}));
	it('the last figure takes its move', () =>
		expect(archiveCopy('Setenta', 'Basic', true)).toEqual({
			title: 'Archive Basic?',
			button: 'Archive and remove move',
			caption:
				'Setenta goes with it: Basic is its last figure. Its recordings and practice history are kept.'
		}));
});

describe('recordingDay', () => {
	it('this year: the long day', () =>
		expect(recordingDay('2026-10-28', '2026-10-31')).toBe('Wednesday, 28 October'));
	it('another year: the year too', () =>
		expect(recordingDay('2025-10-28', '2026-10-31')).toBe('Tuesday, 28 October, 2025'));
});

describe('variationNav', () => {
	const three = [{ id: 4 }, { id: 9 }, { id: 12 }];
	it('steps both ways and wraps', () => {
		expect(variationNav(three, 9)).toEqual({
			index: 1,
			count: 3,
			prev: 4,
			next: 12,
			position: '2 of 3 figures'
		});
		expect(variationNav(three, 12).next).toBe(4);
		expect(variationNav(three, 4).prev).toBe(12);
	});
	it('has nowhere to step with one figure', () => {
		expect(variationNav([{ id: 4 }], 4)).toEqual({
			index: 0,
			count: 1,
			prev: null,
			next: null,
			position: '1 of 1 figure'
		});
	});
	it('counts an unknown id as the first', () => {
		expect(variationNav(three, 99).index).toBe(0);
	});
});

describe('moveState', () => {
	const dile = { name: 'Dile que no', variations: ['Basic', 'Doble'] };
	it('a name that clashes, trimmed and in any case', () =>
		expect(moveState({ last: false, chosen: dile, joinName: '  doble ' })).toEqual({
			cta: 'Move to Dile que no',
			danger: false,
			clash: 'Dile que no already has a doble. Pick another name.',
			blocked: true
		}));
	it('a blank name blocks without a clash', () =>
		expect(moveState({ last: false, chosen: dile, joinName: '' })).toMatchObject({
			blocked: true,
			clash: null
		}));
	it('a free name goes', () =>
		expect(moveState({ last: false, chosen: dile, joinName: 'Cuddle entry' }).blocked).toBe(false));
	it('the last figure removes its move', () =>
		expect(moveState({ last: true, chosen: null, joinName: 'Basic' })).toEqual({
			cta: 'Move and remove move',
			danger: true,
			clash: null,
			blocked: false
		}));
	it('no move chosen: its own move', () =>
		expect(moveState({ last: false, chosen: null, joinName: 'x' }).cta).toBe(
			'Make it its own move'
		));
});

describe('lengthError', () => {
	const msg = '1 to 64 counts. One 8-count is 8.';
	it('a whole number from 1 to 64 is fine', () => {
		expect(lengthError('16')).toBeNull();
		expect(lengthError('64')).toBeNull();
		expect(lengthError('1')).toBeNull();
	});
	it.each(['70', '0', '', '8.5', 'abc', '-8'])('%j is refused', (v) =>
		expect(lengthError(v)).toBe(msg)
	);
});

describe('deleteRecordingBody', () => {
	it('names its sections', () =>
		expect(deleteRecordingBody('Wednesday, 28 October', '34 MB', 2)).toBe(
			'Wednesday, 28 October · 34 MB. Its 2 saved sections go with it. This can’t be undone.'
		));
	it('one section', () =>
		expect(deleteRecordingBody('Wednesday, 28 October', '34 MB', 1)).toBe(
			'Wednesday, 28 October · 34 MB. Its 1 saved section goes with it. This can’t be undone.'
		));
	it('no sections', () =>
		expect(deleteRecordingBody('Wednesday, 28 October', '34 MB', 0)).toBe(
			'Wednesday, 28 October · 34 MB. This can’t be undone.'
		));
});

describe('figureSubtitle', () => {
	it("leads with the group's name for a group's figure", () => {
		expect(figureSubtitle({ startCount: 1, lengthCounts: 8 }, 'Salsa Tuesdays')).toBe(
			'Salsa Tuesdays’ figure · starts on 1 · 8 counts'
		);
	});
	it('names the start and the length', () => {
		expect(figureSubtitle({ startCount: 1, lengthCounts: 16 })).toBe(
			'Figure · starts on 1 · 16 counts'
		);
	});
	it('is just Figure without timing', () => {
		expect(figureSubtitle({ startCount: null, lengthCounts: null })).toBe('Figure');
		expect(figureSubtitle({ startCount: 1, lengthCounts: null })).toBe('Figure');
	});
});

describe('topVideo', () => {
	it('is the first section, before any recording', () => {
		expect(topVideo([{ id: 1 }], [{ id: 9, kind: 'video' as const }])).toEqual({
			kind: 'section',
			section: { id: 1 }
		});
	});
	it('falls back to the first video recording, never an audio one', () => {
		expect(
			topVideo(
				[],
				[
					{ id: 8, kind: 'audio' as const },
					{ id: 9, kind: 'video' as const }
				]
			)
		).toEqual({ kind: 'recording', recording: { id: 9, kind: 'video' } });
		expect(topVideo([], [{ id: 8, kind: 'audio' as const }])).toBeNull();
	});
});

describe('the Recordings list', () => {
	it('counts its items in the heading', () => {
		expect(recordingsTitle(0)).toBe('Recordings');
		expect(recordingsTitle(3)).toBe('Recordings · 3');
	});
	it('says what a recording is and its size', () => {
		expect(recordingMetaLine('video', '24 MB')).toBe('Video · 24 MB');
		expect(recordingMetaLine('audio', '2 MB')).toBe('Audio · 2 MB');
	});
	it('is hidden from a reader when it is empty', () => {
		expect(showRecordings({ canEdit: false, items: 0 })).toBe(false);
		expect(showRecordings({ canEdit: true, items: 0 })).toBe(true);
		expect(showRecordings({ canEdit: false, items: 1 })).toBe(true);
	});
});

describe('the three rows', () => {
	it('counts each, and an empty one says None and does not open', () => {
		expect(relationRows({ follows: 22, leads: 0, routines: 10 })).toEqual([
			{ key: 'follows', label: 'Follows from', count: '22', opens: true },
			{ key: 'leads', label: 'Leads to', count: 'None', opens: false },
			{ key: 'routines', label: 'In routines', count: '10', opens: true }
		]);
	});
	it('titles each sheet', () => {
		expect(relationTitle('routines', 1)).toBe('In 1 routine');
		expect(relationTitle('routines', 10)).toBe('In 10 routines');
		expect(relationTitle('follows', 22)).toBe('Follows from');
		expect(relationTitle('leads', 3)).toBe('Leads to');
	});
	it('puts looping routines first, then by name', () => {
		const sorted = sortRoutines([
			{ name: 'slow song', loops: false },
			{ name: 'Warm-up', loops: true },
			{ name: 'Competition', loops: true },
			{ name: 'Adios run', loops: false }
		]);
		expect(sorted.map((r) => r.name)).toEqual(['Competition', 'Warm-up', 'Adios run', 'slow song']);
	});
	it('searches by every word, ignoring accents and case', () => {
		const rows = [
			{ name: 'Dile que no · Basic' },
			{ name: 'Exhíbela · Basic' },
			{ name: 'Setenta · Basic' }
		];
		expect(filterRows(rows, 'dile').map((r) => r.name)).toEqual(['Dile que no · Basic']);
		expect(filterRows(rows, 'EXHIBELA').map((r) => r.name)).toEqual(['Exhíbela · Basic']);
		expect(filterRows(rows, 'basic set').map((r) => r.name)).toEqual(['Setenta · Basic']);
		expect(filterRows(rows, '  ')).toBe(rows);
	});
});

describe('review fixes', () => {
	it('topVideo skips a recording whose file is missing or will not play', () => {
		const recs = [
			{ id: 9, kind: 'video' as const },
			{ id: 10, kind: 'video' as const }
		];
		expect(topVideo([], recs, new Set([9]))).toEqual({ kind: 'recording', recording: recs[1] });
		expect(topVideo([], recs, new Set([9, 10]))).toBeNull();
	});
	it('says a saved YouTube video came from YouTube', () => {
		expect(recordingMetaLine('video', '24 MB', true)).toBe('From YouTube · 24 MB');
		expect(recordingMetaLine('video', '24 MB', false)).toBe('Video · 24 MB');
	});
	it('the add sheet’s video row waits while a video goes up', () => {
		expect(addVideoRow(true)).toEqual({ disabled: true, meta: 'Wait for the upload to finish' });
		expect(addVideoRow(false)).toEqual({ disabled: false, meta: null });
	});
});

describe('figureMenuItems', () => {
	const on = { create: vi.fn(), move: vi.fn(), archive: vi.fn() };
	const base = {
		canEdit: true,
		reader: false,
		practisable: true,
		exercise: null,
		historyHref: '/salsa/groups/1/history/figure/7',
		variationName: 'Doble'
	};
	const keys = (i: Parameters<typeof figureMenuItems>[0]) =>
		figureMenuItems(i, on).map((x) => x.key);

	it('gives an editor Create exercise, History, Move and Archive, in that order', () => {
		expect(keys(base)).toEqual(['create', 'history', 'moveFigure', 'archive']);
	});
	it('links Its exercise, with its practice line, once there is one', () => {
		const items = figureMenuItems(
			{ ...base, exercise: { href: '/salsa/exercises/3', line: 'Due Sunday' } },
			on
		);
		expect(items.map((x) => x.key)).toEqual(['exercise', 'history', 'moveFigure', 'archive']);
		expect(items[0]).toMatchObject({
			label: 'Its exercise',
			href: '/salsa/exercises/3',
			meta: 'Due Sunday'
		});
	});
	it('gives a reader none of the editor’s items, and no Create (their bar has Practise)', () => {
		expect(keys({ ...base, canEdit: false, reader: true, historyHref: null })).toEqual([]);
	});
	it('offers no Create when the figure cannot be practised', () => {
		expect(keys({ ...base, practisable: false, historyHref: null })).toEqual([
			'moveFigure',
			'archive'
		]);
	});
	it('names the variation on Archive, as a danger item, and wires the taps', () => {
		const items = figureMenuItems(base, on);
		expect(items.at(-1)).toMatchObject({ label: 'Archive Doble', danger: true });
		items.find((x) => x.key === 'create')!.onclick!();
		items.find((x) => x.key === 'moveFigure')!.onclick!();
		expect(on.create).toHaveBeenCalledOnce();
		expect(on.move).toHaveBeenCalledOnce();
		expect(items.find((x) => x.key === 'moveFigure')!.label).toBe('Move to another move…');
	});
});

describe('figureMenuItems while Create exercise is on its way', () => {
	it('leaves Create out, so a second tap cannot send it twice', () => {
		const on = { create: vi.fn(), move: vi.fn(), archive: vi.fn() };
		const items = figureMenuItems(
			{
				canEdit: true,
				reader: false,
				practisable: true,
				exercise: null,
				historyHref: null,
				variationName: 'Doble',
				creating: true
			},
			on
		);
		expect(items.map((x) => x.key)).toEqual(['moveFigure', 'archive']);
	});
});

describe('link rows in Recordings', () => {
	const yt = 'https://m.youtube.com/shorts/7-gpJ0iUxFQ';
	it('shows a YouTube link as YouTube, with Save for an editor', () => {
		expect(linkRowView({ url: yt, title: null, saving: null }, true)).toEqual({
			youtube: true,
			title: 'YouTube',
			meta: 'youtube.com',
			failed: false,
			href: 'https://www.youtube.com/watch?v=7-gpJ0iUxFQ',
			end: 'save'
		});
		expect(linkRowView({ url: yt, title: null, saving: null }, false).end).toBe('open');
	});
	it('says a save is on its way, or why it failed, with Retry for an editor', () => {
		const queued = linkRowView(
			{ url: yt, title: null, saving: { status: 'queued', error: null } },
			true
		);
		expect(queued).toMatchObject({ meta: 'Saving at 480p…', failed: false, end: 'open' });
		const failed = linkRowView(
			{ url: yt, title: null, saving: { status: 'failed', error: 'blocked' } },
			true
		);
		expect(failed).toMatchObject({ meta: 'Couldn’t save: blocked', failed: true, end: 'retry' });
	});
	it('shows a web link by its host, and a title wins', () => {
		const web = 'https://www.facebook.com/share/r/1daKme62TJ/';
		expect(linkRowView({ url: web, title: null, saving: null }, true)).toEqual({
			youtube: false,
			title: 'facebook.com',
			meta: 'facebook.com',
			failed: false,
			href: web,
			end: 'open'
		});
		expect(linkRowView({ url: web, title: 'La policía', saving: null }, true).title).toBe(
			'La policía'
		);
		expect(linkRowView({ url: yt, title: 'Doble tutorial', saving: null }, true).title).toBe(
			'Doble tutorial'
		);
	});
	it('counts links in Recordings, so a reader with only links sees it', () => {
		expect(recordingsCount({ sections: 1, recordings: 0, links: 2 })).toBe(3);
		expect(
			showRecordings({
				canEdit: false,
				items: recordingsCount({ sections: 0, recordings: 0, links: 1 })
			})
		).toBe(true);
	});
});

describe('link rows: review fixes', () => {
	const yt = 'https://m.youtube.com/shorts/7-gpJ0iUxFQ';
	it('shows a reader no save state: there is nothing for them to do about it', () => {
		const failed = linkRowView(
			{ url: yt, title: null, saving: { status: 'failed', error: 'blocked' } },
			false
		);
		expect(failed).toMatchObject({ meta: 'youtube.com', failed: false, end: 'open' });
		const queued = linkRowView(
			{ url: yt, title: null, saving: { status: 'queued', error: null } },
			false
		);
		expect(queued.meta).toBe('youtube.com');
	});
	it('never makes a link of a stored URL that does not parse', () => {
		const v = linkRowView({ url: 'javascript:alert(1)', title: null, saving: null }, true);
		expect(v).toMatchObject({
			youtube: false,
			href: null,
			end: 'none',
			title: 'javascript:alert(1)'
		});
	});
});
