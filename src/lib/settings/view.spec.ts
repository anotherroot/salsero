import { describe, expect, it } from 'vitest';
import { DEFAULT_REMINDER, deviceMeta, reminderToSave } from './view';

describe('reminderToSave', () => {
	it('posts off, a valid time, or nothing', () => {
		expect(reminderToSave(false, '07:05')).toBe('');
		expect(reminderToSave(true, '07:05')).toBe('07:05');
		expect(reminderToSave(true, '')).toBeNull();
		expect(reminderToSave(true, '7:5')).toBeNull();
		expect(reminderToSave(true, DEFAULT_REMINDER)).toBe('19:30');
	});
});

describe('deviceMeta', () => {
	it('says when a phone was paired and last used', () => {
		expect(deviceMeta('2026-10-28', '2026-10-31', '2026-10-31')).toBe(
			'Paired 28 Oct 2026 · last used today'
		);
		expect(deviceMeta('2026-10-28', '2026-10-30', '2026-10-31')).toBe(
			'Paired 28 Oct 2026 · last used yesterday'
		);
		expect(deviceMeta('2026-10-28', '2026-10-01', '2026-10-31')).toBe(
			'Paired 28 Oct 2026 · last used 1 Oct 2026'
		);
		expect(deviceMeta('2026-10-28', null, '2026-10-31')).toBe('Paired 28 Oct 2026');
	});
});
