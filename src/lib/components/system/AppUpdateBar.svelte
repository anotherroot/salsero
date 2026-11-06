<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { focusAfter, focusWasLost } from '$lib/focus';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { iconButton } from '$lib/components/ui/styles';
	import { localDay } from '$lib/day/day';
	import {
		HIDE_UPDATE,
		UPDATE_ROW_TITLE,
		hiddenToday,
		hideMark,
		updateRowLine,
		type AppUpdate
	} from '$lib/app-update/view';
	import UpdateButton from './UpdateButton.svelte';

	/*
	 * Today's "a new version of the app is out" (merge sheets and update bubbles
	 * spec, 3B): one row with the app's icon, which version is ready, and a small
	 * Update. × hides it until tomorrow on this device (browser storage: a
	 * per-device convenience); a newer version shows again.
	 */
	let { update }: { update: AppUpdate } = $props();

	const KEY = $derived(`salsa:update-hidden:${update.dance}`);
	const version = $derived(update.latest?.versionCode ?? 0);
	/** Unknown until the browser has read whether × hid it today: drawn only then. */
	let hidden = $state(true);
	let root: HTMLDivElement | undefined = $state();
	let line = $state<string | null>(null);

	const today = () => localDay(Date.now(), Intl.DateTimeFormat().resolvedOptions().timeZone);

	onMount(() => {
		try {
			hidden = hiddenToday(localStorage.getItem(KEY), today(), version);
		} catch {
			hidden = false;
		}
	});

	/** × hides it: focus goes on to the next control, never to <body>. */
	async function hide() {
		const to = root ? focusAfter(root) : null;
		hidden = true;
		try {
			localStorage.setItem(KEY, hideMark(today(), version));
		} catch {
			// Storage refused: hidden for this page only.
		}
		await tick();
		if (focusWasLost()) to?.focus();
	}
</script>

{#if !hidden}
	<div
		bind:this={root}
		class="mt-3 flex items-center gap-3 rounded-2xl bg-surface py-2.5 pr-1.5 pl-3"
		role="status"
	>
		<img
			src="/icons/{update.dance}-192.png"
			alt=""
			width="44"
			height="44"
			class="size-11 flex-none rounded-xl"
		/>
		<div class="flex min-w-0 flex-1 flex-col">
			<span class="text-[15px] leading-snug font-extrabold text-ink">{UPDATE_ROW_TITLE}</span>
			<span class="text-[13px] leading-snug text-muted">{updateRowLine(update, line)}</span>
		</div>
		<UpdateButton {update} size="sm" onstatus={(l) => (line = l)} />
		<button
			type="button"
			class={iconButton('bare', 'muted')}
			aria-label={HIDE_UPDATE}
			onclick={hide}><Icon name="close" size={20} /></button
		>
	</div>
{/if}
