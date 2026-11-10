/*
 * Who a page says is signed in, for its device (offline phase 2). PURE,
 * client-safe: the root layout's server load says who drew its data, and the
 * root layout hands `pagePerson` to the device (`setPerson`). Only the
 * server's own answer counts: the device's copy says its own person, and the
 * offline shell is cached signed out.
 */
import { SHELL } from './sw-route';

/** Who drew a page's root layout data. */
export type DrawnBy = 'server' | 'device' | 'shell';

/** `onDevice`: the load ran in the device worker; `path`: the request's path. */
export function drawnBy(onDevice: boolean, path: string): DrawnBy {
	if (onDevice) return 'device';
	return path === SHELL ? 'shell' : 'server';
}

/**
 * The page's person: the signed-in id, null when the server says signed out,
 * undefined when the page cannot know (the copy or the shell drew it).
 */
export function pagePerson(data: {
	user?: { id: string } | null;
	drawnBy?: DrawnBy;
}): string | null | undefined {
	if (data.drawnBy !== 'server') return undefined;
	return data.user?.id ?? null;
}

/**
 * Whose gallery originals the Android app is asked about (offline phase 4c): the
 * signed-in id from the server's or the copy's root data (the copy is wiped on a
 * person change, so its person is the signed-in one); undefined from the shell.
 */
export function galleryPerson(data: {
	user?: { id: string } | null;
	drawnBy?: DrawnBy;
}): string | null | undefined {
	if (data.drawnBy === 'shell') return undefined;
	return data.user?.id ?? null;
}
