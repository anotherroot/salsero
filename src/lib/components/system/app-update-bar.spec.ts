import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import AppUpdateBar from './AppUpdateBar.svelte';
import type { AppUpdate } from '$lib/app-update/view';

/*
 * Whether × hid the row today lives in the browser, so the server cannot know
 * it: the row is drawn only once the page has read it, never painted and then
 * pulled away (the list would jump on every visit that day).
 */
const update: AppUpdate = {
	state: 'available',
	channel: 'direct',
	dance: 'salsa',
	installed: 1,
	latest: { versionCode: 2, versionName: '1.1', url: '/releases/salsa/2.apk' }
};

describe('AppUpdateBar', () => {
	it('draws nothing on the server, not even its spacing', () => {
		const { body } = render(AppUpdateBar, { props: { update } });
		expect(body).not.toContain('New version of the app');
		expect(body).not.toContain('pt-3');
	});
});
