/**
 * The Add a link sheet stays mounted between openings (Sheet keeps its
 * contents): a success must clear the form, or the next link quietly takes the
 * last one's Title. No spec runs a component's script, so this reads it.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sheet = readFileSync('src/lib/components/links/AddLinkSheet.svelte', 'utf8');

describe('AddLinkSheet', () => {
	it('clears the form after a link is added, and keeps it after a refusal', () => {
		expect(sheet).toContain("await update({ reset: result.type === 'success' });");
		expect(sheet).not.toContain('await update({ reset: false });');
	});
});
