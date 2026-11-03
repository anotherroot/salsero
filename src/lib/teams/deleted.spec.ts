import { describe, expect, it } from 'vitest';
import { KIND_NAME, TRASH_KINDS, purgeLine, trashRefusalLine } from './deleted';

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
});
