import { failJson } from '$lib/server/files';

export { idOf } from '../timelines/gone';

/** A loop whose section is gone, moved or never was one: the worker stops. */
export const gone = (): Response => failJson(410, 'This section is no longer wanted.');
