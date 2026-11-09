import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import {
	KIND_NAME,
	TRASH_KINDS,
	deletedByLine,
	purgeLine,
	takenLine,
	trashRefusalLine
} from './deleted';

describe('Recently deleted wording', () => {
	it('names a group song, an archived kind with no purge day', () => {
		expect(KIND_NAME.song).toBe('Song');
		expect(KIND_NAME.variation).toBe('Figure');
		expect(TRASH_KINDS.has('song')).toBe(false);
		expect(purgeLine({ purgeOn: null })).toBeNull();
	});

	it('says a restore found a copy of the same thing there already', () => {
		expect(trashRefusalLine('recording', 'family')).toBe('A copy of this is here already.');
		expect(trashRefusalLine('section', 'family')).toBe('A copy of this is here already.');
	});

	it('names a position (archived, not trash) and its link (trash)', () => {
		expect(KIND_NAME.position).toBe('Position');
		expect(KIND_NAME['position-link']).toBe('Position link');
		expect(TRASH_KINDS.has('position')).toBe(false);
		expect(TRASH_KINDS.has('position-link')).toBe(true);
	});

	it('reads its English lines', () => {
		const now = Date.UTC(2026, 10, 8, 12);
		expect(deletedByLine({ by: 'Ana', at: now - 5 * 60_000 }, now)).toBe('Ana · 5 min ago');
		expect(deletedByLine({ by: null, at: now }, now)).toBe('Someone · just now');
		expect(purgeLine({ purgeOn: '2026-12-02' })).toBe('deleted for good on 2 Dec');
		expect(takenLine('Enchufla')).toBe('Enchufla is taken; rename that one first');
		expect(trashRefusalLine('section', 'parent-gone')).toBe('Restore the video first');
		expect(trashRefusalLine('link', 'parent-gone')).toBe('What it was in is gone');
		expect(trashRefusalLine('spot-link', 'exists')).toBe(
			'That section was linked to it again since.'
		);
	});
});

describe('Recently deleted in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);
	const now = Date.UTC(2026, 10, 8, 12);

	it('puts the person after a "·", never declined', () => {
		sl(() => {
			expect(deletedByLine({ by: 'Ana', at: now - 5 * 60_000 }, now)).toBe(
				'Izbrisano · Ana · pred 5 min'
			);
			expect(deletedByLine({ by: null, at: now }, now)).toBe('Izbrisano · Nekdo · pravkar');
			expect(takenLine('Enchufla')).toBe(
				'Ime je že zasedeno: Enchufla. Najprej preimenujte tisto.'
			);
		});
	});

	it('says the day it goes for good', () => {
		expect(sl(() => purgeLine({ purgeOn: '2026-12-02' }))).toBe('Trajni izbris: 2. dec.');
	});

	it('names the kinds when read, and says why a restore was refused', () => {
		// The same table, read in each language.
		expect(sl(() => KIND_NAME.variation)).toBe('Figura');
		expect(KIND_NAME.variation).toBe('Figure');
		sl(() => {
			expect(KIND_NAME['position-link']).toBe('Povezava s položajem');
			expect(trashRefusalLine('section', 'parent-gone')).toBe('Najprej obnovite video');
			expect(trashRefusalLine('position-link', 'parent-gone')).toBe(
				'Najprej obnovite odsek ali točko'
			);
			expect(trashRefusalLine('recording', 'family')).toBe('Kopija tega je že tu.');
			expect(trashRefusalLine('recording', 'purged')).toBe('To je bilo dokončno izbrisano.');
		});
	});
});
