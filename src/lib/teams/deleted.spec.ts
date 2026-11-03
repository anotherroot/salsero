import { describe, expect, it } from 'vitest';
import { KIND_NAME, TRASH_KINDS, purgeLine } from './deleted';

describe('Recently deleted wording', () => {
	it('names a group song, an archived kind with no purge day', () => {
		expect(KIND_NAME.song).toBe('Song');
		expect(TRASH_KINDS.has('song')).toBe(false);
		expect(purgeLine({ purgeOn: null })).toBeNull();
	});
});
