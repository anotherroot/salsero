<script lang="ts">
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { refreshWhenSettled } from '$lib/sheets/history.svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Segmented from '$lib/components/ui/Segmented.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import CompareSheet from './CompareSheet.svelte';
	import FamilyList from './FamilyList.svelte';
	import DropSheet from './DropSheet.svelte';
	import DetachSheet from './DetachSheet.svelte';
	import CopyToSheet from './CopyToSheet.svelte';
	import MoveToSheet from './MoveToSheet.svelte';
	import SameAsSheet from './SameAsSheet.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import { dropped } from './dropped.svelte';
	import { button } from '$lib/components/ui/styles';
	import {
		COMPARE,
		COPY_TO,
		MOVE_TO,
		SAME_AS,
		SEPARATE,
		DETACH_BUTTON,
		OPEN,
		DROP_BUTTON,
		VERSIONS,
		changedLine,
		differsBanner,
		reconnectedLine,
		sourceNote
	} from '$lib/clones/view';
	import type { DanceSlug } from '$lib/dances/dances';
	import type {
		CloneKind,
		CompareOffer,
		CopyOffer,
		DetachOffer,
		DropOptions,
		FamilyView,
		MoveOffer,
		TwinOffer,
		Source
	} from '$lib/types';

	/**
	 * A tab per source at the top of a member page's body (board C2 p2):
	 * "Yours | Salsa Tuesdays | …". Each tab is that member's own page; a
	 * copy's tab, opened while the person has a member of their own, carries
	 * `?vs=<their member>`, so its page offers Take into it. The switch
	 * replaces the history entry: one place in the trail, whichever tab.
	 * Opened that way (`taking`), a source's page says so under the tabs.
	 * On a row the person edits whose group source moved since they took it
	 * (`compare`), a line says what, with Compare (board C2 p2). Under it, when
	 * the person edits another copy (`family`, board C3 p1): "Rueda club’s copy
	 * differs: timing · Compare" per copy that moved, the copies they can see,
	 * and Send mine…. Under them, Copy to… (board C4), Move to… (your own lesson,
	 * board C4 p3), Detach and Drop my copy.
	 */
	let {
		sources,
		kind,
		dance,
		current,
		mineId,
		taking = null,
		compare = null,
		family = null,
		drop = null,
		detach = null,
		copy = null,
		move = null,
		sameAs = null
	}: {
		sources: Source[];
		kind: CloneKind;
		dance: DanceSlug;
		/** The page's own row. */
		current: number;
		/** The person's own member of the family, or null. */
		mineId: number | null;
		/** The page's place, when it was opened from the person's copy: "Salsa Tuesdays’ version, read-only…". */
		taking?: string | null;
		/** "Salsa Tuesdays changed it since you took it: timing · Compare". */
		compare?: CompareOffer | null;
		/** Copies you can see, the differs banners and Send mine…; null when the person edits no other copy. */
		family?: FamilyView | null;
		/** Drop my copy (board C5), on the person's own copy while another version is readable. */
		drop?: DropOptions | null;
		/** Detach (board C8), beside Drop my copy: the copy stops following its source. */
		detach?: DetachOffer | null;
		/** Copy to… (board C4): into your app or a group you own or edit; null when there is nowhere. */
		copy?: CopyOffer | null;
		/** Move to… (board C4 p3): the person's own lesson into a group they own or edit. */
		move?: MoveOffer | null;
		/** Same as… (board C7 p1): the other figures in your app, to tick as twins; null in a group's workspace or with none. */
		sameAs?: TwinOffer | null;
	} = $props();

	let comparing = $state(false);
	/** The copy a differs banner's Compare opened. */
	let against = $state<CompareOffer | null>(null);
	let againstOpen = $state(false);
	let dropping = $state(false);
	let detaching = $state(false);
	let copying = $state(false);
	let moving = $state(false);
	let marking = $state(false);

	/**
	 * "Back on Salsa Tuesdays’. Your copy is archived.": left by a drop for the
	 * page it opened; or "Copied to Salsa Tuesdays as a draft.", with Open (`href`).
	 */
	let toast = $state<{ id: number; message: string; href?: string } | null>(null);
	let toastSeq = 0;
	// Only on the version's own page (`dropped.take`): a landing that failed never shows it later.
	$effect(() => {
		const path = page.url.pathname;
		if (dropped.pending === null) return;
		const message = dropped.take(path);
		if (message) toast = { id: ++toastSeq, message };
	});

	// Follows the page; a tap moves it at once, before the next page lands.
	let value = $derived(String(current));
	const items = $derived(sources.map((s) => ({ value: String(s.id), label: s.label })));

	function pageOf(id: number): string {
		const p = { dance, id: String(id) };
		switch (kind) {
			case 'figure':
				return resolve('/[dance]/(moves)/figures/[id]', p);
			case 'routine':
				return resolve('/[dance]/(moves)/routines/[id]', p);
			case 'drill':
				return resolve('/[dance]/(today)/exercises/[id]', p);
			case 'song':
				return resolve('/[dance]/songs/[id]', p);
			case 'lesson':
				return resolve('/[dance]/lessons/[id]', p);
			case 'position':
				return resolve('/[dance]/(moves)/positions', p); // positions: a page of their own comes later
		}
	}

	function open(to: string) {
		const s = sources.find((x) => String(x.id) === to);
		if (!s || s.id === current) return;
		// A twin is another family: nothing of it is taken into yours.
		const vs = s.relation !== 'twin' && mineId !== null && s.id !== mineId ? `?vs=${mineId}` : '';
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the path is resolved; `vs` is its search
		goto(`${pageOf(s.id)}${vs}`, { replaceState: true, keepFocus: true, noScroll: true });
	}
</script>

{#if sources.length > 1}
	<Segmented name="sources" label={VERSIONS} {items} bind:value onchange={open} />
{/if}
{#if sources.some((s) => s.relation === 'twin')}
	<form
		method="POST"
		action="?/separate"
		class="text-center"
		use:enhance={() => async () => {
			await refreshWhenSettled();
		}}
	>
		<button type="submit" class={button('tertiary', 'sm')}>{SEPARATE}</button>
	</form>
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
	<div
		class="flex items-center gap-2.5 rounded-2xl bg-accent-soft py-2 pr-2 pl-4 text-[14px] leading-snug text-accent-text"
	>
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
		<div
			class="flex items-center gap-2.5 rounded-2xl bg-accent-soft py-2 pr-2 pl-4 text-[14px] leading-snug text-accent-text"
		>
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
	<FamilyList {family} {kind} {dance} {current} />
{/if}
{#if drop || detach || copy || move || sameAs}
	<div class="flex flex-wrap justify-end gap-x-2">
		{#if copy}
			<button
				type="button"
				class={button('tertiary', 'sm')}
				aria-haspopup="dialog"
				onclick={() => (copying = true)}><Icon name="copy" size={20} />{COPY_TO}</button
			>
		{/if}
		{#if sameAs}
			<button
				type="button"
				class={button('tertiary', 'sm')}
				aria-haspopup="dialog"
				onclick={() => (marking = true)}><Icon name="link" size={20} />{SAME_AS}</button
			>
		{/if}
		{#if move}
			<button
				type="button"
				class={button('tertiary', 'sm')}
				aria-haspopup="dialog"
				onclick={() => (moving = true)}><Icon name="move-to" size={20} />{MOVE_TO}</button
			>
		{/if}
		{#if detach}
			<button
				type="button"
				class={button('tertiary', 'sm')}
				aria-haspopup="dialog"
				onclick={() => (detaching = true)}><Icon name="unlink" size={20} />{DETACH_BUTTON}</button
			>
		{/if}
		{#if drop}
			<button
				type="button"
				class={button('danger-text', 'sm')}
				aria-haspopup="dialog"
				onclick={() => (dropping = true)}><Icon name="undo" size={20} />{DROP_BUTTON}</button
			>
		{/if}
	</div>
{/if}
{#if drop}
	<DropSheet open={dropping} onclose={() => (dropping = false)} {drop} fromId={current} />
{/if}
{#if detach}
	<DetachSheet open={detaching} onclose={() => (detaching = false)} {kind} {detach} />
{/if}
{#if copy}
	<CopyToSheet
		open={copying}
		onclose={() => (copying = false)}
		offer={copy}
		{current}
		ondone={(message, href) => (toast = { id: ++toastSeq, message, href })}
	/>
{/if}
{#if sameAs}
	<SameAsSheet open={marking} onclose={() => (marking = false)} offer={sameAs} />
{/if}
{#if move}
	<MoveToSheet open={moving} onclose={() => (moving = false)} offer={move} {current} />
{/if}

<Toast
	toast={toast && {
		id: toast.id,
		message: toast.message,
		action: toast.href ? OPEN : undefined,
		icon: 'check',
		tone: 'done'
	}}
	onaction={() => {
		const href = toast?.href;
		toast = null;
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the server built the copy's path
		if (href) goto(href);
	}}
	ondismiss={() => (toast = null)}
/>
