import { describe, expect, it } from 'vitest';
import { announceSaved, saved } from './saved.svelte';

/* What the [dance] layout's toast shows after a save, whatever screen comes next. */
describe('saved', () => {
	it('holds the last save, each with its own id, until dismissed', () => {
		expect(saved.current).toBeNull();
		announceSaved({
			dance: 'salsa',
			message: 'Saved · back in 12 days',
			undo: { setId: 7, before: null }
		});
		const first = saved.current;
		expect(first).toMatchObject({
			dance: 'salsa',
			message: 'Saved · back in 12 days',
			undo: { setId: 7, before: null }
		});
		// The same words again restart the toast's clock: a new id.
		announceSaved({ dance: 'salsa', message: 'Saved · back in 12 days', undo: null });
		expect(saved.current?.id).not.toBe(first?.id);
		expect(saved.current?.undo).toBeNull();
		saved.dismiss();
		expect(saved.current).toBeNull();
	});
});
