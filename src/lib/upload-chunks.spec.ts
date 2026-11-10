import { describe, expect, it } from 'vitest';
import { putChunks, type PutChunk } from './upload-chunks';

/** A server in memory: holds what came, answers like the chunk routes. */
function server(opts: { failAt?: number[]; refuse?: number } = {}) {
	let have = 0;
	const calls: string[] = [];
	const failAt = [...(opts.failAt ?? [])];
	const put: PutChunk = async (_url, blob, start, total) => {
		calls.push(`${start}-${start + blob.size - 1}/${total}`);
		if (failAt[0] === calls.length) {
			failAt.shift();
			throw new Error('network');
		}
		if (opts.refuse) return { status: opts.refuse, received: have, body: '{"message":"No room."}' };
		if (start !== have) return { status: 409, received: have, body: '' };
		have += blob.size;
		return have >= total
			? { status: 201, received: have, body: '{"id":7}' }
			: { status: 204, received: have, body: '' };
	};
	return { put, calls, have: () => have };
}
const blob = (n: number) => new Blob([new Uint8Array(n)]);

describe('putChunks: a blob, chunk by chunk (offline phase 4c)', () => {
	it('sends it whole in chunks and answers the last body', async () => {
		const s = server();
		const seen: number[] = [];
		const out = await putChunks('/u', blob(25), {
			type: 'video/mp4',
			name: 'a.mp4',
			chunk: 10,
			put: s.put,
			onBytes: (n) => seen.push(n)
		});
		expect(out).toEqual({ ok: true, body: '{"id":7}' });
		expect(s.calls).toEqual(['0-9/25', '10-19/25', '20-24/25']);
		expect(seen.at(-1)).toBe(25);
	});

	it('a dropped connection: the same chunk again', async () => {
		const s = server({ failAt: [2] });
		const out = await putChunks('/u', blob(25), {
			type: 'video/mp4',
			name: 'a',
			chunk: 10,
			put: s.put,
			wait: 0
		});
		expect(out.ok).toBe(true);
		expect(s.calls).toEqual(['0-9/25', '10-19/25', '10-19/25', '20-24/25']);
	});

	it('a refusal: its words, nothing more sent', async () => {
		const s = server({ refuse: 413 });
		expect(
			await putChunks('/u', blob(25), { type: 'video/mp4', name: 'a', chunk: 10, put: s.put })
		).toEqual({ ok: false, reason: 'No room.' });
		expect(s.calls).toHaveLength(1);
	});
});
