import { rm } from 'node:fs/promises';
import { failJson } from '$lib/server/files';
import { timelineDir } from '$lib/server/ai-timelines/store';

/** A timeline whose video is gone (or never was one): its pieces go, the worker stops. */
export async function gone(id: number): Promise<Response> {
	if (Number.isSafeInteger(id) && id > 0)
		await rm(timelineDir(id), { recursive: true, force: true });
	return failJson(410, 'This video is no longer wanted.');
}

export const idOf = (raw: string) => {
	const id = Number(raw);
	return Number.isSafeInteger(id) && id > 0 ? id : 0;
};
