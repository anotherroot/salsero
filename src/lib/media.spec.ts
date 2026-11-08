import { describe, expect, it } from 'vitest';
import { withLocale } from './i18n/current';
import { uploadProblem } from './media';

const MiB = 1024 * 1024;

describe('uploadProblem', () => {
	it('names the size first', () =>
		expect(uploadProblem({ size: 120 * MiB, type: 'video/mp4' }, 'video/*,audio/*')).toEqual({
			title: 'That file is 120 MB; the limit is 95 MB.'
		}));
	it('sends a non-audio file for audio-only to Add video', () => {
		const want = {
			title: 'Only audio files can be added.',
			body: 'Pick a video with Add video instead.'
		};
		expect(uploadProblem({ size: MiB, type: 'image/png' }, 'audio/*')).toEqual(want);
		expect(uploadProblem({ size: MiB, type: 'video/mp4' }, 'audio/*')).toEqual(want);
	});
	it('refuses a file that is neither video nor audio', () =>
		expect(uploadProblem({ size: MiB, type: 'image/png' }, 'video/*,audio/*')).toEqual({
			title: 'Only video and audio files can be added.'
		}));
	it('accepts audio for either', () => {
		expect(uploadProblem({ size: 3 * MiB, type: 'audio/mpeg' }, 'audio/*')).toBeNull();
		expect(uploadProblem({ size: 3 * MiB, type: 'audio/mpeg' }, 'video/*,audio/*')).toBeNull();
	});
});

describe('uploadProblem, video only', () => {
	it('takes a video and refuses an audio file', () => {
		expect(uploadProblem({ size: 1024, type: 'video/mp4' }, 'video/*')).toBeNull();
		expect(uploadProblem({ size: 1024, type: 'audio/mpeg' }, 'video/*')).toEqual({
			title: 'Only video files can be added.'
		});
	});
});

describe('uploadProblem in Slovenian', () => {
	it('says what may be added', () => {
		const sl = (size: number, type: string, accept: 'audio/*' | 'video/*' | 'video/*,audio/*') =>
			withLocale('sl', () => uploadProblem({ size, type }, accept));
		expect(sl(120 * MiB, 'video/mp4', 'video/*,audio/*')).toEqual({
			title: 'Datoteka meri 120 MB; največ je 95 MB.'
		});
		expect(sl(MiB, 'video/mp4', 'audio/*')).toEqual({
			title: 'Dodate lahko samo zvočne datoteke.',
			body: 'Video izberite z gumbom Dodaj video.'
		});
		expect(sl(MiB, 'audio/mpeg', 'video/*')).toEqual({
			title: 'Dodate lahko samo video datoteke.'
		});
		expect(sl(MiB, 'image/png', 'video/*,audio/*')).toEqual({
			title: 'Dodate lahko samo video ali zvočne datoteke.'
		});
	});
});
