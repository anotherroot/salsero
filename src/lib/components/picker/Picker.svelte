<script lang="ts">
	/**
	 * The one picker behind every list: a search, groups of rows, and what a tap
	 * does is the owner's business. It never fetches and never posts.
	 *
	 * - 'link': a tap links and closes; + links and keeps picking (a spinner
	 *   while it is in flight, "✓ Linked" once the owner's data says so) and
	 *   Done closes.
	 * - 'field': a tap fills a field; the current value carries an accent ✓.
	 *   With `multi` (a field that takes any number): `chosen` is a Set, a tap
	 *   toggles (the owner's `onpick`) and the sheet stays open, an optional
	 *   `clear` row clears all, and Done · N closes.
	 * - 'act': a tap does something; plain rows.
	 *
	 * Every button is type="button" and the search has no name: a field picker
	 * sits inside a form, and nothing in here may post it.
	 *
	 * Light: the site's `Sheet`. Dark: a `PlayerLayer` inside the full-screen
	 * player's <dialog>, which carries the media palette. Token classes only.
	 */
	import { untrack, type Snippet } from 'svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import PlayerLayer from '$lib/components/ui/PlayerLayer.svelte';
	import SearchField from '$lib/components/ui/SearchField.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { button, CLIP, iconButton, SECTION_LABEL } from '$lib/components/ui/styles';
	import type { IconName } from '$lib/icons/icons';
	import { segments, shown, type PickGroup, type PickRow } from '$lib/picker/model';
	import {
		createLead,
		doneLabel,
		emptyText,
		lineGroups,
		pickerBody,
		pickerTall,
		rowTrail,
		type ArchivedChoice
	} from '$lib/picker/view';

	interface Props {
		open: boolean;
		title: string;
		/** A muted line under the title. */
		sub?: string;
		/** A level stacked on another (a field's picker, the picker over the links level): Back, no ×. */
		back?: boolean;
		/** Search placeholder: "Search figures". */
		placeholder: string;
		groups: PickGroup[];
		/** 'link': rows get + and ✓ Linked; 'field': `chosen` gets ✓; 'act': plain rows. */
		kind: 'link' | 'field' | 'act';
		/** 'field': the current value's `key`. */
		chosen?: string | ReadonlySet<string> | null;
		/** 'field': takes any number: a tap keeps the sheet open and Done · N closes it. */
		multi?: boolean;
		/** 'field' + `multi`: a row above the groups that clears every value ("No position"); ✓ while none is chosen. */
		clear?: { label: string; meta: string };
		onclear?: () => void;
		/** A create is in flight (`oncreate` is pending): the create buttons show busy and ignore taps. */
		creating?: boolean;
		/** The empty box without a query (rule 7). */
		nothingLeft: string;
		/** The empty box's icon when nothing was typed. */
		emptyIcon?: IconName;
		/** The create row (rule 6), bare nouns ("Figure"): the picker draws the +. Absent: no row. */
		create?: { key: string; label: string }[];
		/** How many + this opening has linked; Done shows when > 0. Owned by the caller. */
		added?: number;
		/** Keys whose + is in flight: a spinner in place of the +. */
		pending?: ReadonlySet<string>;
		/** A refused link, shown above the list. */
		message?: string | null;
		/**
		 * The refused link's target was archived since ("Archived by Ana"): the
		 * banner offers Pick another, and Restore when the person may.
		 */
		archived?: ArchivedChoice | null;
		/** The rows are on their way: a skeleton list, the search disabled. */
		loading?: boolean;
		/** The rows could not be loaded: a banner in place of the list. */
		failure?: { title: string; body: string } | null;
		/** 'dark': a PlayerLayer inside the player's <dialog>; 'light': Sheet.svelte. */
		theme?: 'light' | 'dark';
		/** Dark only: the layer's z-index class. */
		z?: string;
		/** The caller already filtered `groups` by `query` (the routine editor). */
		prefiltered?: boolean;
		query?: string;
		/** Under the search: the routine editor's context line and chips. */
		top?: Snippet;
		/** Replaces the empty box's text (the routine editor's "Turn off Hold"). */
		empty?: Snippet;
		onpick: (row: PickRow) => void;
		onadd?: (row: PickRow) => void;
		onpreview?: (row: PickRow) => void;
		oncreate?: (key: string, query: string) => void;
		ondone?: () => void;
		/** ×, Back, Escape, the backdrop: one level back (rule 8). */
		onclose: () => void;
	}

	let {
		open,
		title,
		sub,
		back,
		placeholder,
		groups,
		kind,
		chosen = null,
		multi = false,
		clear,
		onclear,
		creating = false,
		nothingLeft,
		emptyIcon = 'search',
		create,
		added = 0,
		pending = new Set<string>(),
		message = null,
		archived = null,
		loading = false,
		failure = null,
		theme = 'light',
		z,
		prefiltered = false,
		query = $bindable(''),
		top,
		empty,
		onpick,
		onadd,
		onpreview,
		oncreate,
		ondone,
		onclose
	}: Props = $props();

	let search: HTMLInputElement | undefined = $state();

	// Every opening starts with an empty search.
	$effect(() => {
		if (open) query = '';
	});

	// Focus the search only with a mouse: on a phone the keyboard would cover
	// the list, which is what the picker was opened to see.
	$effect(() => {
		if (search && !loading && !failed && matchMedia('(pointer: fine)').matches) search.focus();
	});

	const lines = $derived(shown(groups, prefiltered ? '' : query));
	const typed = $derived(query.trim());
	const failed = $derived(failure != null);
	const shows = $derived(pickerBody({ loading, failed, lines: lines.length }));
	// Decided once per opening: a prefiltered list shrinking as you type must not resize the sheet.
	let tallOpen = $state(false);
	$effect(() => {
		if (!open) tallOpen = false;
		else if (!loading) tallOpen = untrack(() => pickerTall({ loading, failed, groups }));
	});
	const tall = $derived(loading ? true : tallOpen);
	const hasCreate = $derived(!!create && create.length > 0);
	const many = $derived(kind === 'field' && multi);
	const chosenCount = $derived(typeof chosen === 'object' && chosen ? chosen.size : 0);
	const hasDone = $derived(many || (kind === 'link' && added > 0));
	const showClear = $derived(many && !!clear && !typed);

	/** Board "Loading" rows: the two bars' widths, in %. */
	const SKELETON = [
		[62, 40],
		[48, 56],
		[70, 34],
		[54, 46],
		[66, 38]
	];
</script>

{#snippet marked(text: string)}
	<!-- What the search matched, every word, the same in every picker (and the song popup). -->
	{#if typed}{#each segments(text, typed) as s, i (i)}{#if s.hit}<mark
					class="rounded-[4px] bg-accent-soft px-px font-extrabold text-accent-text">{s.text}</mark
				>{:else}{s.text}{/if}{/each}{:else}{text}{/if}
{/snippet}

{#snippet row(r: PickRow, text: string, indent: boolean, last: boolean)}
	{@const trail = rowTrail(kind, r, chosen, pending)}
	{@const linked = trail === 'linked'}
	{@const isChosen = trail === 'chosen'}
	<div
		class="flex items-center has-[[data-pick]:active]:bg-step {indent ? 'pl-8' : 'pl-4'} {isChosen
			? 'bg-accent-soft'
			: ''}"
	>
		{#if r.preview}
			<button
				type="button"
				class="{iconButton('tonal')} mr-2.5"
				aria-label="Play {r.label}"
				onclick={() => onpreview?.(r)}><Icon name="play" size={18} filled /></button
			>
		{/if}
		<div class="flex min-w-0 flex-1 items-center {last ? '' : 'border-b border-hairline'}">
			<button
				type="button"
				data-pick
				class="group/pick flex min-h-14 min-w-0 flex-1 cursor-pointer flex-col justify-center gap-0.5 rounded-xl py-[9px] text-left disabled:cursor-default {trail ===
				'none'
					? 'pr-3.5'
					: ''}"
				disabled={linked}
				aria-current={isChosen ? 'true' : undefined}
				onclick={() => onpick(r)}
			>
				<span
					class="block max-w-full truncate text-[16px] leading-[1.3] font-bold {linked
						? 'text-muted'
						: 'text-ink'}">{@render marked(text)}</span
				>
				{#if r.meta}
					<!-- Pressed, the row is bg-step, where muted is 4.29:1 in light: ink-2 then. -->
					<span
						class="block max-w-full truncate text-[13px] leading-[1.35] {isChosen
							? 'text-ink-2'
							: 'text-muted group-active/pick:text-ink-2'}">{r.meta}</span
					>
				{/if}
			</button>
			{#if trail === 'add'}
				<button
					type="button"
					class="{iconButton('bare', 'accent')} mr-1.5"
					aria-label="Link {r.label} and keep picking"
					onclick={() => onadd?.(r)}><Icon name="plus" size={24} /></button
				>
			{:else if trail === 'pending'}
				<span
					role="status"
					aria-label="Linking {r.label}"
					class="mr-1.5 flex size-11 flex-none items-center justify-center text-accent"
					><Spinner size={22} /></span
				>
			{:else if linked}
				<span
					class="flex flex-none items-center gap-1 pr-3 pl-1 text-[13px] font-bold whitespace-nowrap text-muted"
					><Icon name="check" size={16} />Linked</span
				>
			{:else if isChosen}
				<span class="flex flex-none pr-3.5 text-accent-text" aria-hidden="true"
					><Icon name="check" size={22} /></span
				>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet clearRow(c: { label: string; meta: string })}
	{@const none = chosenCount === 0}
	<div class="{CLIP} flex-none rounded-2xl bg-surface">
		<div
			class="flex items-center pl-4 has-[[data-pick]:active]:bg-step {none ? 'bg-accent-soft' : ''}"
		>
			<button
				type="button"
				data-pick
				class="flex min-h-14 min-w-0 flex-1 cursor-pointer flex-col justify-center gap-0.5 rounded-xl py-[9px] text-left"
				aria-current={none ? 'true' : undefined}
				onclick={() => onclear?.()}
			>
				<span class="block max-w-full truncate text-[16px] leading-[1.3] font-bold text-ink"
					>{c.label}</span
				>
				<span
					class="block max-w-full truncate text-[13px] leading-[1.35] {none
						? 'text-ink-2'
						: 'text-muted'}">{c.meta}</span
				>
			</button>
			{#if none}
				<span class="flex flex-none pr-3.5 text-accent-text" aria-hidden="true"
					><Icon name="check" size={22} /></span
				>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet list()}
	{#if shows === 'loading'}
		<div class="ml-4 h-3 w-24 rounded-md bg-skeleton" aria-hidden="true"></div>
		<div class="rounded-2xl bg-surface" aria-busy="true">
			<span role="status" class="sr-only">Loading</span>
			{#each SKELETON as [a, b], i (i)}
				<div class="flex min-h-16 items-center pl-4" aria-hidden="true">
					<div
						class="flex min-h-16 flex-1 flex-col justify-center gap-2 pr-4 {i < SKELETON.length - 1
							? 'border-b border-hairline'
							: ''}"
					>
						<div class="h-3 rounded-md bg-skeleton" style:width="{a}%"></div>
						<div class="h-2.5 rounded-md bg-skeleton" style:width="{b}%"></div>
					</div>
				</div>
			{/each}
		</div>
	{:else if shows === 'failed' && failure}
		<Banner kind="error" title={failure.title}>{failure.body}</Banner>
	{:else if shows === 'empty'}
		<div role="status" class="flex flex-none items-start gap-3 rounded-2xl bg-surface p-4">
			<span class="mt-px flex-none text-muted"
				><Icon name={typed ? 'search' : emptyIcon} size={22} /></span
			>
			<div class="min-w-0 text-[15px] leading-[1.45] font-medium text-ink-2">
				{#if empty}{@render empty()}{:else}{emptyText(typed, nothingLeft)}{/if}
			</div>
		</div>
	{:else}
		{#each lineGroups(lines) as g, gi (gi)}
			<h3 class="{SECTION_LABEL} {gi > 0 ? 'mt-2.5' : ''}">{g.title}</h3>
			<div class="{CLIP} rounded-2xl bg-surface">
				{#each g.lines as { line, last }, i (i)}
					{#if line.kind === 'heading'}
						<!-- A heading, not a choice: only the rows under it can be picked. -->
						<p
							class="truncate px-4 pt-3.5 pb-0.5 text-[13px] leading-[1.3] font-extrabold tracking-[0.01em] text-ink-2"
						>
							{@render marked(line.text)}
						</p>
					{:else}
						{@render row(line.row, line.text, line.indent, last)}
					{/if}
				{/each}
			</div>
		{/each}
	{/if}
{/snippet}

{#snippet body()}
	<div class="flex h-full min-h-0 flex-col gap-2">
		<!-- No name: it filters, it is not posted. Enter must not submit a surrounding form. -->
		<SearchField
			{placeholder}
			bind:value={query}
			bind:input={search}
			disabled={loading || failed}
			onkeydown={(e) => {
				if (e.key === 'Enter') e.preventDefault();
			}}
		/>

		{@render top?.()}

		{#if showClear && clear}{@render clearRow(clear)}{/if}

		{#if message}
			<Banner kind="error" title="That could not be linked." action={archived ? choices : undefined}
				>{message}</Banner
			>
		{/if}

		<!-- Only the list scrolls: the search, the create row and Done stay put. -->
		<div class="-mx-4 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
			<div class="flex flex-col gap-2">{@render list()}</div>
		</div>
	</div>
{/snippet}

{#snippet choices()}
	{#if archived}
		<div class="flex flex-wrap gap-1">
			{#if archived.onrestore}
				<button
					type="button"
					class={button('tertiary', 'sm')}
					aria-busy={archived.restoring}
					disabled={archived.restoring}
					onclick={archived.onrestore}
					>{#if archived.restoring}<Spinner /><span class="sr-only">Restoring…</span
						>{:else}Restore{/if}</button
				>
			{/if}
			<button type="button" class={button('tertiary', 'sm')} onclick={archived.onpickanother}
				>Pick another</button
			>
		</div>
	{/if}
{/snippet}

{#snippet footer()}
	{#if hasCreate && create}
		<p class="pl-1 text-[13px] font-bold text-muted">{createLead(typed)}</p>
		<div role="group" aria-label={createLead(typed)} class="flex gap-2">
			{#each create as m (m.key)}
				<button
					type="button"
					class="flex h-11 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1 rounded-full bg-accent-soft px-2 text-[15px] font-extrabold whitespace-nowrap text-accent-text active:brightness-95 disabled:cursor-default"
					disabled={creating}
					aria-busy={creating}
					onclick={() => oncreate?.(m.key, typed)}
					>{#if creating}<Spinner size={18} /><span class="sr-only">Creating…</span>{:else}<Icon
							name="plus"
							size={18}
						/>{m.label}{/if}</button
				>
			{/each}
		</div>
	{/if}
	{#if hasDone}
		<button
			type="button"
			class={button('primary', 'md', true)}
			onclick={() => (ondone ?? onclose)()}
			>{many ? doneLabel(chosenCount, 'field') : doneLabel(added)}</button
		>
	{/if}
{/snippet}

{#if theme === 'dark'}
	{#if open}
		<!-- Inside the player's <dialog>: an overlay, not a second top-layer dialog. -->
		<PlayerLayer
			{title}
			{sub}
			{back}
			{z}
			{tall}
			footer={hasCreate || hasDone ? footer : undefined}
			{onclose}
		>
			{@render body()}
		</PlayerLayer>
	{/if}
{:else}
	<Sheet
		{title}
		{open}
		{onclose}
		{back}
		{sub}
		{tall}
		footer={hasCreate || hasDone ? footer : undefined}
	>
		{@render body()}
	</Sheet>
{/if}
