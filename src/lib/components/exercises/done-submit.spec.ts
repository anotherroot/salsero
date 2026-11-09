import { describe, expect, it, vi } from 'vitest';
import type { ActionResult } from '@sveltejs/kit';
import { doneSubmit, type DoneForm } from './done-submit';
import type { DoneResult } from '$lib/types';

/*
 * The Done sheet's save, as its form runs it (`DoneSheet.svelte` passes this to
 * `use:guarded`). Run here with a plain object for the sheet's state: a face tap
 * sets `tapped`, the submit names the face and the time, the answer clears or
 * refuses. (No component spec mounts a sheet in this repo: specs render on the
 * server only, where no form submits.)
 */
function sheet(over: Partial<DoneForm> = {}) {
	const saved: DoneResult[] = [];
	const f: DoneForm = {
		tapped: 'gotit',
		feel: null,
		busy: null,
		refusal: null,
		seconds: 252,
		onsaved: (r) => saved.push(r),
		...over
	};
	return { f, saved };
}

type Submit = Parameters<ReturnType<typeof doneSubmit>>[0];
type After = (o: {
	result: ActionResult;
	update: (o?: { reset?: boolean }) => Promise<void>;
}) => Promise<void>;

async function run(f: DoneForm, result: ActionResult, update = vi.fn(async () => {})) {
	const formData = new FormData();
	const after = (await doneSubmit(f)({ formData } as unknown as Submit)) as unknown as After;
	const sent = Object.fromEntries(formData);
	const busyWhileOut = f.busy;
	await after({ result, update });
	return { sent, busyWhileOut, update };
}

const ok: DoneResult = { ok: true, setId: 7, before: null, backDays: 12 };

describe('the Done sheet’s save', () => {
	it('posts the tapped face and the time read at the tap; busy on that face while out', async () => {
		const { f } = sheet();
		const { sent, busyWhileOut } = await run(f, { type: 'success', status: 200, data: { ...ok } });
		expect(sent).toEqual({ rating: '4', durationS: '252' });
		expect(busyWhileOut).toBe('gotit');
		expect(f.feel).toBe('gotit');
	});

	it('a past day (no time) posts no durationS', async () => {
		const { f } = sheet({ seconds: null });
		const { sent } = await run(f, { type: 'success', status: 200, data: { ...ok } });
		expect(sent).toEqual({ rating: '4' });
	});

	it('a success refreshes the page first, then hands the result on, and clears busy', async () => {
		const order: string[] = [];
		const { f } = sheet({ onsaved: () => order.push('saved') });
		const update = vi.fn(async () => void order.push('update'));
		await run(f, { type: 'success', status: 200, data: { ...ok } }, update);
		expect(update).toHaveBeenCalledWith({ reset: false });
		expect(order).toEqual(['update', 'saved']);
		expect(f.busy).toBeNull();
		expect(f.tapped).toBeNull();
	});

	it('a refresh that throws still hands the save on', async () => {
		const { f, saved } = sheet();
		await run(
			f,
			{ type: 'success', status: 200, data: { ...ok } },
			vi.fn(async () => {
				throw new Error('offline');
			})
		);
		expect(saved).toEqual([ok]);
		expect(f.busy).toBeNull();
	});

	it('a refusal clears busy and shows the server’s words; nothing is handed on', async () => {
		const { f, saved } = sheet();
		const { update } = await run(f, {
			type: 'failure',
			status: 400,
			data: { action: 'done', message: 'That exercise no longer exists.' }
		});
		expect(f.busy).toBeNull();
		expect(f.tapped).toBeNull();
		expect(f.refusal).toBe('That exercise no longer exists.');
		expect(saved).toEqual([]);
		expect(update).not.toHaveBeenCalled();
	});

	it('offline: says nothing of its own (the root layout says it, translated), keeps the face and note', async () => {
		const { f, saved } = sheet();
		await run(f, { type: 'failure', status: 503, data: { offline: true } });
		expect(f.busy).toBeNull();
		expect(f.refusal).toBeNull();
		expect(f.feel).toBe('gotit');
		expect(saved).toEqual([]);
	});

	it('an error or a refusal without words says it did not save', async () => {
		for (const result of [
			{ type: 'error', error: new Error('500') },
			{ type: 'failure', status: 400, data: {} }
		] as ActionResult[]) {
			const { f } = sheet();
			await run(f, result);
			expect(f.busy).toBeNull();
			expect(f.refusal).toBe('It did not save.');
		}
	});

	it('a new save clears an earlier refusal', async () => {
		const { f } = sheet({ refusal: 'Earlier' });
		const formData = new FormData();
		await doneSubmit(f)({ formData } as unknown as Submit);
		expect(f.refusal).toBeNull();
	});
});
