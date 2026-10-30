<script lang="ts">
	/**
	 * The one picker behind every list: a search, groups of rows, and what a tap
	 * does is the owner's business. It never fetches and never posts.
	 *
	 * - 'link': a tap links and closes; + links and keeps picking (the row turns
	 *   "✓ Linked" once the owner's data says so) and Done closes.
	 * - 'field': a tap fills a field; the current value carries an accent ✓.
	 * - 'act': a tap does something; plain rows.
	 *
	 * Every button is type="button" and the search has no name: a field picker
	 * sits inside a form, and nothing in here may post it.
	 */
	import type { Snippet } from 'svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import { shown, type PickGroup, type PickRow } from '$lib/picker/model';

	interface Props {
		open: boolean;
		title: string;
		/** Search placeholder: "Search figures". */
		placeholder: string;
		groups: PickGroup[];
		/** 'link': rows get + and ✓ Linked; 'field': `chosen` gets ✓; 'act': plain rows. */
		kind: 'link' | 'field' | 'act';
		/** 'field': the current value's `key`. */
		chosen?: string | null;
		/** The empty box without a query (rule 7). */
		nothingLeft: string;
		/** The create row (rule 6). Absent: no row. */
		create?: { key: string; label: string }[];
		/** How many + this opening has linked; Done shows when > 0. Owned by the caller. */
		added?: number;
		/** A refused link, shown above the list. */
		message?: string | null;
		/** 'dark': an overlay inside the player's <dialog> with --pl-* tokens; 'light': Sheet.svelte. */
		theme?: 'light' | 'dark';
		/** The caller already filtered `groups` by `query` (the routine editor). */
		prefiltered?: boolean;
		query?: string;
		/** Under the search: the routine editor's context line and chips. */
		top?: Snippet;
		/** Replaces the empty box (the routine editor's "Turn off Hold"). */
		empty?: Snippet;
		onpick: (row: PickRow) => void;
		onadd?: (row: PickRow) => void;
		onpreview?: (row: PickRow) => void;
		oncreate?: (key: string, query: string) => void;
		ondone?: () => void;
		/** ×, Escape, the backdrop: one level back (rule 8). */
		onclose: () => void;
	}

	let {
		open,
		title,
		placeholder,
		groups,
		kind,
		chosen = null,
		nothingLeft,
		create,
		added = 0,
		message = null,
		theme = 'light',
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
		if (search && matchMedia('(pointer: fine)').matches) search.focus();
	});

	const lines = $derived(shown(groups, prefiltered ? '' : query));
	const typed = $derived(query.trim());

	const dark = $derived(theme === 'dark');
	const c = $derived(
		dark
			? {
					card: 'border border-(--pl-hover) bg-(--pl-surface) text-(--pl-ink)',
					muted: 'text-(--pl-muted)',
					ink2: 'text-(--pl-ink-2)',
					line: 'border-(--pl-raised)',
					accent: 'text-(--pl-accent)',
					search:
						'border-(--pl-hover) bg-(--pl-raised) text-(--pl-ink) focus-within:border-(--pl-accent)',
					hover: 'enabled:hover:bg-(--pl-accent)/10',
					on: 'bg-(--pl-accent)/10',
					plus: 'border-(--pl-accent) text-(--pl-accent)',
					play: 'border-(--pl-tick) text-(--pl-ink)',
					box: 'bg-(--pl-raised) text-(--pl-ink-2)',
					dashed: 'border-(--pl-tick) text-(--pl-ink-2)',
					go: 'bg-(--pl-accent) text-(--pl-accent-ink)',
					error: 'text-(--pl-danger)'
				}
			: {
					card: '',
					muted: 'text-muted',
					ink2: 'text-ink-2',
					line: 'border-line',
					accent: 'text-accent',
					search: 'border-rule bg-raised focus-within:border-accent',
					hover: 'enabled:hover:bg-accent/10',
					on: 'bg-accent/10',
					plus: 'border-accent text-accent',
					play: 'border-rule text-ink',
					box: 'bg-plane text-ink-2',
					dashed: 'border-rule text-accent',
					go: 'bg-accent text-accent-ink',
					error: 'text-danger'
				}
	);
	const round = 'grid size-9 shrink-0 cursor-pointer place-items-center rounded-full';
</script>

{#snippet header()}
	<!-- The dark overlay's own header; the light one is Sheet's. -->
	<header class="mb-3 flex items-center justify-between gap-3">
		<h2 class="text-[16px] font-semibold">{title}</h2>
		<button
			type="button"
			class="-mr-2 grid size-10 cursor-pointer place-items-center rounded-full text-[20px] {c.muted}"
			aria-label="Close"
			onclick={onclose}>×</button
		>
	</header>
{/snippet}

{#snippet row(r: PickRow, text: string, indent: boolean)}
	{@const linked = kind === 'link' && r.linked === true}
	{@const isChosen = kind === 'field' && chosen != null && r.key === chosen}
	<div class="flex items-center gap-1.5 border-b {c.line} {isChosen ? c.on : ''}">
		{#if r.preview}
			<button
				type="button"
				class="{round} border text-[11px] {c.play}"
				aria-label="Play {r.label}"
				onclick={() => onpreview?.(r)}>▶</button
			>
		{/if}
		<button
			type="button"
			class="flex min-h-12 min-w-0 flex-1 cursor-pointer flex-col justify-center py-2 pr-1 text-left disabled:cursor-default {indent
				? 'pl-5 text-[14px]'
				: 'pl-0.5 text-[15px]'} {linked ? c.muted : c.hover}"
			disabled={linked}
			aria-current={isChosen ? 'true' : undefined}
			onclick={() => onpick(r)}
		>
			<span class="block truncate"
				>{#if indent}<span class={c.muted}>└&nbsp;</span>{/if}{text}</span
			>
			{#if r.meta}<span class="block truncate text-[12px] {c.muted}">{r.meta}</span>{/if}
		</button>
		{#if linked}
			<span class="shrink-0 pr-1 text-[12.5px] {c.muted}">✓ Linked</span>
		{:else if isChosen}
			<span class="shrink-0 pr-2 text-[15px] font-semibold {c.accent}" aria-hidden="true">✓</span>
		{:else if kind === 'link'}
			<button
				type="button"
				class="{round} border-[1.5px] text-[20px] leading-none font-semibold {c.plus}"
				aria-label="Link {r.label} and keep picking"
				onclick={() => onadd?.(r)}>+</button
			>
		{/if}
	</div>
{/snippet}

{#snippet body()}
	<label class="flex h-11 items-center gap-2 rounded-[10px] border px-3 {c.search}">
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.2"
			stroke-linecap="round"
			class="shrink-0 {c.muted}"
			aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg
		>
		<span class="sr-only">{placeholder}</span>
		<!-- No name: it filters, it is not posted. Enter must not submit a surrounding form. -->
		<input
			bind:this={search}
			bind:value={query}
			type="search"
			{placeholder}
			autocomplete="off"
			onkeydown={(e) => {
				if (e.key === 'Enter') e.preventDefault();
			}}
			class="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
		/>
	</label>

	{@render top?.()}

	{#if message}<p class="mt-2 text-[13px] {c.error}" role="alert">{message}</p>{/if}

	<!-- Only the list scrolls: the search, the create row and Done stay put. -->
	<div class="mt-1 max-h-[55dvh] overflow-y-auto overscroll-contain">
		{#if lines.length === 0}
			<div class="mt-3 rounded-lg p-3 text-[13px] {c.box}">
				{#if empty}
					{@render empty()}
				{:else if typed}
					Nothing matches “{typed}”.
				{:else}
					{nothingLeft}
				{/if}
			</div>
		{/if}
		{#each lines as line, i (i)}
			{#if line.kind === 'group'}
				<p class="mt-3 mb-1 text-[11px] font-medium tracking-wide uppercase {c.muted}">
					{line.title}
				</p>
			{:else if line.kind === 'heading'}
				<!-- A heading, not a choice: only the rows under it can be picked. -->
				<p class="truncate pt-2 pb-0.5 text-[13px] font-medium {c.muted}">{line.text}</p>
			{:else}
				{@render row(line.row, line.text, line.indent)}
			{/if}
		{/each}
	</div>

	{#if create && create.length > 0}
		<div class="mt-1.5 border-t pt-2.5 {c.line}">
			<p class="text-[12.5px] {c.muted}">
				{typed ? `Not in the list? Create “${typed}” as` : 'Not in the list?'}
			</p>
			<div class="mt-1 flex gap-1.5">
				{#each create as m (m.key)}
					<button
						type="button"
						class="h-10 min-w-0 flex-1 cursor-pointer rounded-xl border border-dashed text-[13px] font-semibold {c.dashed}"
						onclick={() => oncreate?.(m.key, typed)}>{m.label}</button
					>
				{/each}
			</div>
		</div>
	{/if}

	{#if kind === 'link' && added > 0}
		<button
			type="button"
			class="mt-3 h-11 w-full cursor-pointer rounded-xl text-[15px] font-semibold {c.go}"
			onclick={() => (ondone ?? onclose)()}>Done · {added} linked</button
		>
	{/if}
{/snippet}

{#if dark}
	{#if open}
		<!-- Inside the player's <dialog>: an overlay, not a second top-layer dialog. -->
		<div
			class="absolute inset-0 z-40 grid place-items-center bg-black/60 p-4"
			role="presentation"
			onclick={(e) => {
				if (e.target === e.currentTarget) onclose();
			}}
			onkeydown={(e) => {
				// Escape here, not the player's dialog's cancel: one level back.
				if (e.key !== 'Escape') return;
				e.preventDefault();
				e.stopPropagation();
				onclose();
			}}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-label={title}
				class="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-2xl p-4 shadow-[0_16px_40px_rgb(0_0_0/0.6)] {c.card}"
			>
				{@render header()}
				{@render body()}
			</div>
		</div>
	{/if}
{:else}
	<Sheet {title} {open} {onclose}>{@render body()}</Sheet>
{/if}
