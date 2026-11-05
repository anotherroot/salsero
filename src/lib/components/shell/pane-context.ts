import { getContext, setContext } from 'svelte';

/*
 * Whether a component sits in the item pane of a list and its item (desktop,
 * "A list and the item beside it"). Set by the pane only (`Pane.svelte`, which
 * `ListPane` renders around the item), so the list and the band row beside it
 * are not in it. Screen reads it to draw its header as the pane's header on the
 * desktop; BandButton to take the pane's tone. True on the phone too: what it
 * changes is `desk:` only.
 */
const KEY = Symbol('pane');

/** Mark everything this component renders as inside the pane. Call during component init. */
export function setPane(): void {
	setContext(KEY, true);
}

/** Inside the pane. Call during component init. */
export function inPane(): boolean {
	return getContext<boolean | undefined>(KEY) === true;
}
