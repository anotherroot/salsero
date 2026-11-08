import type { ClientInit } from '@sveltejs/kit';
import { startDevice } from '$lib/offline/device.svelte';

/** The device starts beside the app, never in its way: not awaited. */
export const init: ClientInit = () => {
	startDevice();
};
