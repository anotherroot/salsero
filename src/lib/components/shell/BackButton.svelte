<script lang="ts">
	import { page } from '$app/state';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import { listOf, paneBack } from '$lib/nav/pane';
	import { besideToday } from '$lib/nav/today-pane';
	import { backByHistory, backFor, intend, listOpener } from '$lib/nav/trail.svelte';
	import type { DanceSlug } from '$lib/dances/dances';
	import { inPane } from './pane-context';

	/**
	 * The band's back: to the page this one was opened from (`$lib/nav/trail.ts`),
	 * else `fallback`, the tab's main list. A real link, so long-press, open in a
	 * new tab and preloading still work; when the slot below in history is the
	 * target, a tap steps history instead, so the browser's Back and this one
	 * agree and the page comes back with its scroll.
	 *
	 * In a list's item pane on the desktop it shows only for an item opened from
	 * outside its list (`paneBack`, by `listOpener`: the opener the list column also
	 * goes by, so a page entered fresh has neither the opener's list nor a ‹). The
	 * gate is CSS (`desk:hidden`): `inPane()` is true at every width, and the phone
	 * keeps its ‹. Anything else in the header's `left` (a Stop editing ×) is not
	 * gated.
	 */
	let { fallback, focusKey }: { fallback: { href: string; label: string }; focusKey?: string } =
		$props();

	const target = $derived(backFor(page.url.pathname, fallback));
	const pane = inPane();
	// In a pane on the desktop the header is on the ground: a bare ink ‹.
	const tone = pane ? 'pane-back' : 'band';
	const hidden = $derived.by(() => {
		if (!pane) return false;
		const l = listOf(page.route.id);
		if (!l) return false;
		const opener = listOpener(page.url.pathname);
		// An exercise opened from Coming up has Coming up beside it.
		const list = besideToday(page.route.id, page.url.pathname, opener) ?? l.list;
		return !paneBack(opener, list, page.params.dance as DanceSlug, l.under ?? false);
	});

	function onclick(e: MouseEvent) {
		if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		intend('back');
		if (backByHistory(target.key)) e.preventDefault();
	}
</script>

<span class={hidden ? 'contents desk:hidden' : 'contents'}
	><BandButton
		icon="back"
		label={target.label}
		href={target.href}
		{focusKey}
		{onclick}
		{tone}
	/></span
>
