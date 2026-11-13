<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
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
	import {
		nextPhase,
		SENT_MS,
		sendingLabel,
		sentLabel,
		type StepPhase
	} from '$lib/clones/step-view';
	import { t } from '$lib/i18n/catalog';
	import type { DanceSlug } from '$lib/dances/dances';
	import type { CloneKind, FamilyView, KeepView, PlaceRef, Source, StepView } from '$lib/types';

	/**
	 * Whose version (spec 2026-11-06, option D), at the top of a family page's
	 * body: one row, "Your version · Also: Sreda 17:30 · 2 ▾", that opens the
	 * Versions list; under it the notice when the person's copies disagree
	 * ("Your copies don't agree" · Sync, spec 2026-11-07; while Keep in step's
	 * changes are on their way, only "Sending to 2 copies…" over the row's
	 * "Also: …"), and the read-only
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
	// Keep in step is about clones: a row whose other versions are only its twins
	// (which never sync) has nothing to keep in step with.
	const cloned = $derived(lines.some((l) => !l.current && !l.twin));
	// Copy to…'s toast belongs to this page: gone with it, so it never shows on a later one.
	$effect(() => () => copied.clear());

	let listing = $state(false);
	let keeping = $state(false);
	let syncing = $state(false);

	/**
	 * Keep in step's changes on their way (device first): "Sending to 2
	 * copies…" fades in over the row's "Also: …", then "Copies updated" for a
	 * moment once they went, then it fades out. `shown` and `count` outlast the
	 * phase, so the words stay while they fade.
	 */
	let phase = $state<StepPhase>('idle');
	let shown = $state<StepPhase>('idle');
	let count = $state(0);
	let sentTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		const prev = untrack(() => phase);
		const next = nextPhase(prev, step);
		if (step && step.sending > 0) count = step.sending;
		if (next === prev) return;
		clearTimeout(sentTimer);
		if (next === 'sent') sentTimer = setTimeout(() => (phase = 'idle'), SENT_MS);
		if (next !== 'idle') shown = next;
		phase = next;
	});
	$effect(() => () => clearTimeout(sentTimer));

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
				<!-- The status lies over "Also: …", which stays (see-through) so the row keeps its height. -->
				<span class="grid text-[13px]">
					<span
						class="col-start-1 row-start-1 text-muted transition-opacity duration-300 motion-reduce:transition-none {phase ===
						'idle'
							? ''
							: 'opacity-0'}"
						aria-hidden={phase === 'idle' ? undefined : 'true'}>{row.meta}</span
					>
					<span
						role="status"
						class="col-start-1 row-start-1 flex items-start gap-1.5 font-semibold transition-opacity duration-300 motion-reduce:transition-none {phase ===
						'idle'
							? 'opacity-0'
							: ''} {shown === 'sent' ? 'text-done' : 'text-accent-text'}"
						aria-hidden={phase === 'idle' ? 'true' : undefined}
					>
						{#if shown === 'sending'}
							<span class="mt-[2px] flex-none"><Spinner size={14} /></span>{sendingLabel(count)}
						{:else if shown === 'sent'}
							<span class="mt-[2px] flex-none"><Icon name="check" size={14} stroke={3} /></span
							>{sentLabel(count)}
						{/if}
					</span>
				</span>
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
		keep={cloned ? (keep?.settings ?? null) : null}
		onkeep={keep && cloned ? () => (keeping = true) : undefined}
	/>
	{#if keep && cloned}
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
		if (href) goto(href);
	}}
	ondismiss={() => {
		if (copied.toast) copied.clear();
		else landed = null;
	}}
/>
