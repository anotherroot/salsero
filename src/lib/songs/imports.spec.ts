import { describe, expect, it } from 'vitest';
import { importRowView, importSections, sourceLine } from './imports';
import type { SongImportRow } from '$lib/types';

const row = (over: Partial<SongImportRow> = {}): SongImportRow => ({
	id: 1,
	kind: 'spotify-playlist',
	name: 'Salsa clásica',
	status: 'ready',
	error: null,
	count: 32,
	truncated: false,
	group: null,
	...over
});

describe('sourceLine', () => {
	it('names the kind and the count, and a cut list', () => {
		expect(sourceLine('spotify-playlist', 32, false)).toBe('Spotify playlist · 32 songs');
		expect(sourceLine('spotify-album', 1, false)).toBe('Spotify album · 1 song');
		expect(sourceLine('youtube-playlist', 200, true)).toBe(
			'YouTube playlist · 200 songs · the first 200'
		);
	});
});

describe('importRowView', () => {
	it('a list being read: Cancel', () => {
		expect(importRowView(row({ status: 'reading', kind: 'youtube-playlist', count: 0 }))).toEqual({
			title: 'Reading playlist…',
			meta: 'YouTube · the home PC reads it within a minute or two',
			tone: null,
			action: 'cancel'
		});
	});

	it('a read list: Pick songs, named by its group when it has one', () => {
		expect(importRowView(row())).toEqual({
			title: 'Salsa clásica',
			meta: 'Spotify playlist · 32 songs',
			tone: null,
			action: 'pick'
		});
		expect(importRowView(row({ name: null, group: { id: 1, name: 'Sreda 17:30' } }))).toMatchObject(
			{
				title: 'Spotify playlist',
				meta: 'Spotify playlist · 32 songs · Sreda 17:30'
			}
		);
	});

	it('a failed read: its reason, Retry and Dismiss', () => {
		expect(
			importRowView(row({ status: 'failed', error: 'This playlist is private' }))
		).toMatchObject({
			meta: 'Failed: This playlist is private',
			tone: 'danger',
			action: 'retry-dismiss'
		});
	});
});

describe('importSections', () => {
	it('puts the read lists under To pick, the rest under Being added', () => {
		const ready = row({ id: 1 });
		const reading = row({ id: 2, status: 'reading' });
		const failed = row({ id: 3, status: 'failed' });
		expect(importSections([reading, ready, failed])).toEqual({
			toPick: [ready],
			adding: [reading, failed]
		});
	});
});
