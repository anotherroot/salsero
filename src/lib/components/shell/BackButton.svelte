<script lang="ts">
	import { page } from '$app/state';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import { backByHistory, backFor, intend } from '$lib/nav/trail.svelte';
	import { inPane } from './pane-context';

	/**
	 * The band's back: to the page this one was opened from (`$lib/nav/trail.ts`),
	 * else `fallback`, the tab's main list. A real link, so long-press, open in a
	 * new tab and preloading still work; when the slot below in history is the
	 * target, a tap steps history instead, so the browser's Back and this one
	 * agree and the page comes back with its scroll.
	 */
	let { fallback, focusKey }: { fallback: { href: string; label: string }; focusKey?: string } =
		$props();

	const target = $derived(backFor(page.url.pathname, fallback));
	// In a pane on the desktop the header is on the ground: a bare ink ‹.
	const tone = inPane() ? 'pane-back' : 'band';

	function onclick(e: MouseEvent) {
		if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		intend('back');
		if (backByHistory(target.key)) e.preventDefault();
	}
</script>

<BandButton icon="back" label={target.label} href={target.href} {focusKey} {onclick} {tone} />
