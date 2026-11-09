<script lang="ts">
	import { untrack } from 'svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { connection } from '$lib/offline/connection.svelte';
	import { sync } from '$lib/offline/device.svelte';
	import { pinned } from '$lib/nav/chrome.svelte';
	import { t } from '$lib/i18n/catalog';
	import { nextMarks, nextTick, stripState, type Strip, type StripMarks } from '$lib/sync/strip';
	import { stripText } from '$lib/sync/view';

	/**
	 * The offline strip (offline phase 3, look C2, picked 2026-11-09): amber,
	 * above the page's own bottom bar (the figure switcher, Done, Save) and the
	 * tab bar. Offline it says so and how many changes wait; back online it says
	 * it is sending, then "All sent" for a moment. See opens the Sync page.
	 * `--strip-h` (set on the layout by `onheight`) lifts toasts and pads the page.
	 */
	let {
		dance,
		onheight
	}: {
		/** The dance the Sync page is under; null: no See link. */
		dance: string | null;
		/** The strip's height in px (0 when hidden), for the layout. */
		onheight: (px: number) => void;
	} = $props();

	let marks = $state<StripMarks>({ backOnlineAt: null, sentUntil: null });
	let now = $state(Date.now());
	const strip = $derived(stripState(connection.online, sync.summary, now, marks));
	const words = $derived(stripText(strip));

	// The strip as it was before the latest change: "all sent" only follows changes it showed.
	let last: Strip = null;
	let prev = { online: connection.online, waiting: sync.summary?.waiting ?? 0 };
	$effect(() => {
		const next = { online: connection.online, waiting: sync.summary?.waiting ?? 0 };
		untrack(() => {
			const at = Date.now();
			const shown = last !== null && last.kind !== 'sent';
			marks = nextMarks({ ...prev, shown }, next, at, marks);
			now = at;
			prev = next;
		});
	});
	$effect(() => {
		last = strip;
	});
	// The clock moves only when the words would change by it (the grace, the window, "All sent").
	$effect(() => {
		const at = nextTick(sync.summary, now, marks);
		if (at === null) return;
		const timer = setTimeout(() => (now = Date.now()), Math.max(0, at - Date.now()) + 10);
		return () => clearTimeout(timer);
	});

	let height = $state(0);
	$effect(() => onheight(words ? height : 0));
</script>

{#if words && strip}
	<div
		class="fixed inset-x-0 z-30 border-t border-warn/25 bg-warn-soft text-warn desk:left-(--pane-left)"
		style:bottom="calc(var(--pin-bottom, 0px) + {pinned.height}px)"
		style:padding-bottom={pinned.height > 0 ? '0px' : 'var(--pin-safe, var(--safe-bottom))'}
		role="status"
		data-offline-strip
		bind:offsetHeight={height}
	>
		<div
			class="mx-auto flex h-9 max-w-[560px] items-center justify-between gap-3 px-4 text-[14px] font-bold"
		>
			<span class="flex min-w-0 items-center gap-2">
				<Icon name={strip.kind === 'sent' ? 'check' : 'cloud-off'} size={17} />
				<span class="truncate">{words}</span>
			</span>
			{#if dance && strip.kind !== 'sent'}
				<a href="/{dance}/sync" class="flex-none font-extrabold whitespace-nowrap"
					>{t().sync.strip.see} ›</a
				>
			{/if}
		</div>
	</div>
{/if}
