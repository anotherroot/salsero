<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import { GROUP } from '$lib/components/ui/styles';
	import KeepInStep from './KeepInStep.svelte';
	import SyncNotice from './SyncNotice.svelte';
	import SyncSheet from './SyncSheet.svelte';
	import VersionsSheet from './VersionsSheet.svelte';
	import { copied } from './copied.svelte';
	import { dropped } from './dropped.svelte';
	import { versionList, versionRow } from '$lib/clones/versions';
	import { openLabel, sourceNote } from '$lib/clones/view';
	import { t } from '$lib/i18n/catalog';
	import type { DanceSlug } from '$lib/dances/dances';
	import type { CloneKind, FamilyView, KeepView, PlaceRef, Source, StepView } from '$lib/types';

	/**
	 * Whose version (spec 2026-11-06, option D), at the top of a family page's
	 * body: one row, "Your version · Also: Sreda 17:30 · 2 ▾", that opens the
	 * Versions list; under it the notice when the person's copies disagree
	 * ("Your copies don't agree" · Sync, spec 2026-11-07), and the read-only
	 * note on a source's page. The Versions list ends in Sync… and the quiet
	 * Keep in step line, which opens its level over the list. No row with one
	 * version. Mount it wherever the page shows its versions, even with one: it
	 * is also where the drop's landing toast and Copy to…'s toast show.
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
		family = null,
		step = null,
		keep = null
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
		family?: FamilyView | null;
		/** Where the copies stand: the notice's lines. */
		step?: StepView | null;
		/** Keep in step, and how Sync opens from this row (null: no Sync). */
		keep?: KeepView | null;
	} = $props();

	const row = $derived(versionRow({ sources, current, self }));
	const lines = $derived(versionList({ sources, current, family, self }));
	const canSync = $derived(!!keep?.mode);
	// Copy to…'s toast belongs to this page: gone with it, so it never shows on a later one.
	$effect(() => () => copied.clear());

	let listing = $state(false);
	let keeping = $state(false);
	let syncing = $state(false);

	/** "Back on Sreda 17:30’s. Your copy is archived.": left by a drop for the page it opened. */
	let landed = $state<{ id: number; message: string } | null>(null);
	let seq = 0;
	$effect(() => {
		const path = page.url.pathname;
		if (dropped.pending === null) return;
		const message = dropped.take(path);
		if (message) landed = { id: ++seq, message };
	});
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
				<span class="text-[13px] text-muted">{row.meta}</span>
			</span>
			<span class="flex flex-none items-center gap-0.5 text-[15px] font-bold text-accent-text"
				><span class="sr-only">{t().clones.versions.count}</span>{row.count}<Icon
					name="chevron-down"
					size={18}
				/></span
			>
		</button>
	</div>
	<VersionsSheet
		open={listing}
		onclose={() => {
			// Keep in step is a level of the list: closed with it, whichever way it closes.
			listing = false;
			keeping = false;
		}}
		{lines}
		{title}
		{kind}
		{dance}
		{mineId}
		onsync={canSync ? () => (syncing = true) : undefined}
		keep={keep?.settings ?? null}
		onkeep={keep ? () => (keeping = true) : undefined}
	/>
	{#if keep}
		<KeepInStep open={listing && keeping} onclose={() => (keeping = false)} {keep} {title} />
	{/if}
{/if}
{#if step && canSync}
	<SyncNotice {step} pageMine={self.kind === 'mine'} onsync={() => (syncing = true)} />
{/if}
{#if canSync}
	<SyncSheet open={syncing} onclose={() => (syncing = false)} {kind} id={current} />
{/if}

{#if taking}
	<p
		class="flex items-start gap-2.5 rounded-2xl bg-accent-soft px-4 py-3 text-[14px] leading-snug text-accent-text"
	>
		<span class="mt-px flex-none"><Icon name="group" size={18} /></span>
		<span>{sourceNote(taking)}</span>
	</p>
{/if}
<!-- One toast at a time: Copy to…'s (with Open), else the drop's landing. -->
<Toast
	toast={copied.toast
		? {
				id: copied.toast.id,
				message: copied.toast.message,
				action: copied.toast.href ? openLabel() : undefined,
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
