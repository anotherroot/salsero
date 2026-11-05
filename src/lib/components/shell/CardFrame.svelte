<script lang="ts">
	import type { Snippet } from 'svelte';
	import Screen from '$lib/components/ui/Screen.svelte';

	/**
	 * Sign in, Join, Welcome, Get the app, Pair and a group code's Join (desktop
	 * spec, "Pages without the side"): no frame. On the desktop the window is the
	 * band colour, the title sits on it, and the page's content sits in a centred
	 * card, 480 px wide, `ground`, radius 28, with `note` under it on the band.
	 *
	 * On the phone it is the page's Screen as it always was: every wrapper here is
	 * `display: contents` below 1024, and `note` is the small centred line that
	 * followed the form in the sheet.
	 */
	let {
		title,
		subtitle,
		note,
		left,
		children
	}: {
		title: string;
		subtitle?: string;
		note?: string;
		left?: Snippet;
		children: Snippet;
	} = $props();
</script>

<!--
	The band-coloured window: a column as tall as the window at least, the title,
	the card and the note centred in it. The root layout lets it run full width.
-->
<div
	class="contents desk:flex desk:min-h-dvh desk:w-full desk:flex-col desk:items-center desk:justify-center desk:gap-[22px] desk:bg-band desk:px-4 desk:py-12"
	data-card-frame
>
	<Screen {title} {subtitle} {left} card>
		<div
			class="contents desk:flex desk:flex-col desk:gap-3 desk:rounded-[28px] desk:bg-ground desk:p-6 desk:shadow-[0_24px_60px_rgb(0_0_0/0.25)]"
			data-card
		>
			{@render children()}
		</div>
		{#if note}
			<p
				class="mt-1.5 text-center text-[13px] text-muted desk:mt-0 desk:max-w-[420px] desk:self-center desk:leading-[1.45] desk:text-band-small"
			>
				{note}
			</p>
		{/if}
	</Screen>
</div>
