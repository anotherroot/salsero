import { describe, expect, it } from 'vitest';
import { moveHeading, possessive, usedAsIs } from './view';

describe('clone words', () => {
	it('possessive: a final s takes only the apostrophe', () => {
		expect(possessive('Salsa Tuesdays')).toBe('Salsa Tuesdays’');
		expect(possessive('Rueda club')).toBe('Rueda club’s');
	});
	it('usedAsIs', () => {
		expect(usedAsIs('Salsa Tuesdays')).toBe('Salsa Tuesdays’ · used as it is');
	});
	it("moveHeading: a group's move is labelled with the group", () => {
		expect(moveHeading('Enchufla')).toBe('Enchufla');
		expect(moveHeading('Enchufla', { name: 'Salsa Tuesdays' })).toBe('Enchufla · Salsa Tuesdays');
	});
});
