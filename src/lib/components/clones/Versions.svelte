<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import { GROUP, button } from '$lib/components/ui/styles';
	import CompareSheet from './CompareSheet.svelte';
	import SendSheet from './SendSheet.svelte';
	import VersionsSheet from './VersionsSheet.svelte';
	import { copied } from './copied.svelte';
	import { dropped } from './dropped.svelte';
	import { versionList, versionRow } from '$lib/clones/versions';
	import {
		COMPARE,
		OPEN,
		changedLine,
		differsBanner,
		reconnectedLine,
		sourceNote
	} from '$lib/clones/view';
	import type { DanceSlug } from '$lib/dances/dances';
	import type { CloneKind, CompareOffer, FamilyView, PlaceRef, Source } from '$lib/types';

	/**
	 * Whose version (spec 2026-11-06, option D), at the top of a family page's
	 * body: one row, "Your version · Also: Sreda 17:30 · 2 ▾", that opens the
	 * Versions list; then, as before, the read-only note on a source's page, the
	 * compare line and a banner per copy that differs, each with Compare. No row
	 * with one version. Mount it wherever the page shows its versions, even with
	 * one: it is also where the drop's landing toast and Copy to…'s toast show.
	 */
	let {
		sources,
		kind,
		dance,
		current,
		mineId,
		self,
		title,
		taking = null,
		compare = null,
		family = null
	}: {
		sources: Source[];
		kind: CloneKind;
		dance: DanceSlug;
		/** The page's own row. */
		current: number;
		/** The person's own member of the family, or null. */
		mineId: number | null;
		/** Whose the page's row is (`cloneLine.self`). */
		self: PlaceRef;
		/** The item's name, under the list's title. */
		title: string;
		/** The page's place, when it was opened from the person's copy: "Sreda 17:30’s version, read-only…". */
		taking?: string | null;
		compare?: CompareOffer | null;
		family?: FamilyView | null;
	} = $props();

	const row = $derived(versionRow({ sources, current, self, compare, family }));
	const lines = $derived(versionList({ sources, current, family }));

	let listing = $state(false);
	let sending = $state(false);
	let comparing = $state(false);
	/** The copy a differs banner's Compare opened. */
	let against = $state<CompareOffer | null>(null);
	let againstOpen = $state(false);

	/** "Back on Sreda 17:30’s. Your copy is archived.": left by a drop for the page it opened. */
	let landed = $state<{ id: number; message: string } | null>(null);
	let seq = 0;
	$effect(() => {
		const path = page.url.pathname;
		if (dropped.pending === null) return;
		const message = dropped.take(path);
		if (message) landed = { id: ++seq, message };
	});

	const BANNER =
		'flex items-center gap-2.5 rounded-2xl bg-accent-soft py-2 pr-2 pl-4 text-[14px] leading-snug text-accent-text';
</script>

{#if row}
	<div class={GROUP}>
		<button
			type="button"
			class="flex min-h-16 w-full cursor-pointer items-center gap-3 py-2 pr-3.5 pl-4 text-left active:bg-step"
			aria-haspopup="dialog"
			onclick={() => (listing = true)}
		>
			<span
				class="flex size-10 flex-none items-center justify-center rounded-xl bg-accent-soft text-accent-text"
				aria-hidden="true"><Icon name={row.icon} size={22} /></span
			>
			<span class="flex min-w-0 flex-1 flex-col gap-0.5">
				<span class="text-[16px] leading-tight font-bold text-ink">{row.title}</span>
				<span class="text-[13px] {row.changed ? 'font-bold text-status' : 'text-muted'}"
					>{row.meta}</span
				>
			</span>
			<span class="flex flex-none items-center gap-0.5 text-[15px] font-bold text-accent-text"
				><span class="sr-only">Versions:</span>{row.count}<Icon
					name="chevron-down"
					size={18}
				/></span
			>
		</button>
	</div>
	<VersionsSheet
		open={listing}
		onclose={() => (listing = false)}
		{lines}
		{title}
		{kind}
		{dance}
		{mineId}
		onsend={family?.canSend ? () => (sending = true) : undefined}
	/>
{/if}
{#if family?.canSend}
	<SendSheet open={sending} onclose={() => (sending = false)} {kind} fromId={current} />
{/if}

{#if taking}
	<p
		class="flex items-start gap-2.5 rounded-2xl bg-accent-soft px-4 py-3 text-[14px] leading-snug text-accent-text"
	>
		<span class="mt-px flex-none"><Icon name="group" size={18} /></span>
		<span>{sourceNote(taking)}</span>
	</p>
{/if}
{#if compare}
	<div class={BANNER}>
		<span class="flex-none"><Icon name="refresh" size={18} /></span>
		<span class="min-w-0 flex-1 py-1"
			>{compare.rejoined
				? reconnectedLine(compare.place, compare.changed.length)
				: changedLine(compare.place, compare.changed)}</span
		>
		<button type="button" class={button('tertiary', 'sm')} onclick={() => (comparing = true)}
			>{COMPARE}</button
		>
	</div>
	<CompareSheet
		open={comparing}
		onclose={() => (comparing = false)}
		{kind}
		mineId={current}
		theirsId={compare.id}
		place={compare.place}
	/>
{/if}
{#if family}
	{#each family.banners as b (b.id)}
		<div class={BANNER}>
			<span class="flex-none"><Icon name="refresh" size={18} /></span>
			<span class="min-w-0 flex-1 py-1">{differsBanner(b.place, b.changed)}</span>
			<button
				type="button"
				class={button('tertiary', 'sm')}
				onclick={() => {
					against = b;
					againstOpen = true;
				}}>{COMPARE}</button
			>
		</div>
	{/each}
	{#if against}
		<CompareSheet
			open={againstOpen}
			onclose={() => (againstOpen = false)}
			{kind}
			mineId={current}
			theirsId={against.id}
			place={against.place}
		/>
	{/if}
{/if}

<!-- One toast at a time: Copy to…'s (with Open), else the drop's landing. -->
<Toast
	toast={copied.toast
		? {
				id: copied.toast.id,
				message: copied.toast.message,
				action: copied.toast.href ? OPEN : undefined,
				icon: 'check',
				tone: 'done'
			}
		: landed && { id: landed.id, message: landed.message, icon: 'check', tone: 'done' }}
	onaction={() => {
		const href = copied.toast?.href;
		copied.clear();
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the server built the copy's path
		if (href) goto(href);
	}}
	ondismiss={() => {
		if (copied.toast) copied.clear();
		else landed = null;
	}}
/>
