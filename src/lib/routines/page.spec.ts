import { describe, expect, it } from 'vitest';
import {
	bandCompact,
	factBadges,
	factsOf,
	failurePlace,
	fingerprintToSend,
	makeRoutineCaption,
	seamLabel,
	selectionTitle,
	slotMeta
} from './page';

const name = (id: number) => ({ 1: 'Open', 2: 'Closed', 3: 'Hammerlock' })[id] ?? '?';

describe('routine page derivations', () => {
	it('picks the band size from the name', () => {
		expect(bandCompact('Shine combo')).toBe(false);
		expect(bandCompact('Hammerlock combo')).toBe(false);
		expect(bandCompact('Hammerlock combo con vuelta y salida')).toBe(true);
		expect(bandCompact('Hammerlockcombo')).toBe(true);
	});
	it('states where it starts and ends', () => {
		expect(factsOf(['Open'], ['Closed'])).toEqual({ from: 'Open', to: 'Closed' });
		expect(factsOf(['Open'], ['Closed', 'Hammerlock'])).toEqual({
			from: 'Open',
			to: 'Closed or Hammerlock'
		});
	});
	it('has no fact for a side with no position', () => {
		expect(factsOf(['Open', 'Closed'], [])).toEqual({ from: 'Open or Closed', to: null });
		expect(factsOf([], ['Closed'])).toEqual({ from: null, to: 'Closed' });
		expect(factsOf([], [])).toBeNull();
	});
	it('badges loops, breaks and timing breaks', () => {
		expect(factBadges({ slots: 0, breaks: 0, timingBreaks: 0, loops: false })).toEqual([]);
		expect(factBadges({ slots: 3, breaks: 0, timingBreaks: 0, loops: true })).toEqual([
			{ tone: 'done', text: 'Loops', loop: true }
		]);
		expect(factBadges({ slots: 6, breaks: 1, timingBreaks: 2, loops: false })).toEqual([
			{ tone: 'warn', text: 'Doesn’t loop', loop: true },
			{ tone: 'danger', text: '1 break', loop: false },
			{ tone: 'danger', text: '2 timing breaks', loop: false }
		]);
	});
	it('writes a slot’s meta line', () => {
		const e = { starts: [1], startCounts: [1], ends: [2], next: 1 };
		expect(slotMeta(e, name, null)).toBe('1→1 · Open → Closed');
		expect(slotMeta({ starts: [1], startCounts: [1], ends: [1], next: 1 }, name, 3)).toBe(
			'Routine · 3 slots · 1→1 · Open → Open'
		);
		expect(slotMeta({ starts: [1, 2], startCounts: [1], ends: [2, 3], next: 1 }, name, null)).toBe(
			'1→1 · Open / Closed → Closed / Hammerlock'
		);
		expect(slotMeta({ starts: [], startCounts: [], ends: null, next: null }, name, null)).toBe('');
		expect(slotMeta({ starts: [], startCounts: [], ends: null, next: null }, name, 1)).toBe(
			'Routine · 1 slot'
		);
	});
	it('shows nothing for a side with no position, and never a “?” for an end', () => {
		expect(slotMeta({ starts: [], startCounts: [1], ends: [], next: 1 }, name, null)).toBe('1→1');
		expect(slotMeta({ starts: [], startCounts: [1], ends: [], next: 1 }, name, 2)).toBe(
			'Routine · 2 slots · 1→1'
		);
		expect(slotMeta({ starts: [1], startCounts: [1], ends: [], next: 1 }, name, null)).toBe(
			'1→1 · Open →'
		);
		expect(slotMeta({ starts: [], startCounts: [1], ends: [2], next: 1 }, name, null)).toBe(
			'1→1 · → Closed'
		);
		// Options that disagree on their ends: unknown, shown as nothing.
		expect(slotMeta({ starts: [1], startCounts: [1], ends: null, next: 1 }, name, null)).toBe(
			'1→1 · Open →'
		);
	});
	it('words a seam', () => {
		expect(seamLabel({ ends: ['Hammerlock'], next: ['Open'] }, null)).toBe(
			'Ends in Hammerlock, next starts from Open'
		);
		expect(seamLabel(null, { ready: 5, next: [1] })).toBe('Ready for 5, next starts on 1');
		expect(
			seamLabel({ ends: ['Shadow'], next: ['Open', 'Closed'] }, { ready: 5, next: [1, 3] })
		).toBe('Ends in Shadow, next starts from Open or Closed · ready for 5, next starts on 1 or 3');
	});
	it('words a seam out of a slot with two ends', () => {
		expect(seamLabel({ ends: ['Shadow', 'Hammerlock'], next: ['Open'] }, null)).toBe(
			'Ends in Shadow or Hammerlock, next starts from Open'
		);
	});
	it('titles the selection and captions Make routine', () => {
		expect(selectionTitle(0)).toBe('Select slots');
		expect(selectionTitle(3)).toBe('3 selected');
		expect(makeRoutineCaption(3)).toBe(
			'The 3 slots move into the new routine, and it takes their place here as one slot.'
		);
		expect(makeRoutineCaption(1)).toBe(
			'The slot moves into the new routine, and it takes its place here as one slot.'
		);
	});
	it('places a refusal', () => {
		expect(failurePlace(null, [4])).toBeNull();
		expect(failurePlace({ ok: true }, [4])).toBeNull();
		expect(failurePlace({ action: 'rename', field: 'notes', message: 'm' }, [4])).toEqual({
			where: 'edit',
			field: 'notes',
			message: 'm'
		});
		expect(failurePlace({ action: 'rename', message: 'm' }, [4])).toEqual({
			where: 'edit',
			field: 'name',
			message: 'm'
		});
		expect(failurePlace({ action: 'extract', field: 'name', message: 'm' }, [4])).toEqual({
			where: 'extract',
			field: 'name',
			message: 'm'
		});
		expect(failurePlace({ action: 'extract', message: 'm' }, [4])).toEqual({
			where: 'extract',
			field: null,
			message: 'm'
		});
		expect(failurePlace({ stepId: 4, message: 'm' }, [4])).toEqual({
			where: 'slot',
			stepId: 4,
			message: 'm'
		});
		expect(failurePlace({ stepId: 9, message: 'm' }, [4])).toEqual({
			where: 'banner',
			message: 'm'
		});
		expect(failurePlace({ message: 'Those slots could not be put back.' }, [4])).toEqual({
			where: 'banner',
			message: 'Those slots could not be put back.'
		});
	});
});

describe('failurePlace and the clash check', () => {
	it('leaves a clash or gone on the Edit form to the clash sheet', () => {
		expect(failurePlace({ action: 'rename', message: 'x', clash: {} }, [])).toBeNull();
		expect(failurePlace({ action: 'rename', message: 'x', gone: {} }, [])).toBeNull();
	});
	it('puts a stale slot action in the banner', () => {
		expect(
			failurePlace({ message: 'This routine changed; it now shows the latest', stale: true }, [1])
		).toEqual({
			where: 'banner',
			message: 'This routine changed; it now shows the latest'
		});
	});
});

describe('fingerprintToSend', () => {
	it('lets three quick actions aimed at one routine follow each other', () => {
		const a = { sent: 'fp0', after: 'fp1' };
		const b = { sent: fingerprintToSend('fp0', [a]), after: 'fp2' };
		expect(b.sent).toBe('fp1');
		expect(fingerprintToSend('fp0', [a, b])).toBe('fp2');
	});
	it('skips a refused one in the middle', () => {
		const a = { sent: 'fp0', after: 'fp1' };
		const b = { sent: 'fp1', after: null };
		expect(fingerprintToSend('fp0', [a, b])).toBe('fp1');
	});
	it('follows a move and its move back without going round', () => {
		const a = { sent: 'fp0', after: 'fp1' };
		const b = { sent: 'fp1', after: 'fp0' };
		expect(fingerprintToSend('fp0', [a, b])).toBe('fp0');
	});
	it('leaves one aimed after the others landed as it is', () => {
		expect(fingerprintToSend('fp2', [{ sent: 'fp0', after: 'fp1' }])).toBe('fp2');
	});
});
