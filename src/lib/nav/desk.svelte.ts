import { MediaQuery } from 'svelte/reactivity';

/**
 * Whether the window is desktop width (from 1024 px). For behaviour only
 * (focus, the pane's back rule); layout is CSS, `desk:` and the frame variables.
 * The server answers false.
 */
export const desk = new MediaQuery('(width >= 1024px)', false);
