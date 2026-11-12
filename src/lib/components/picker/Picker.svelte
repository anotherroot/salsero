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
	import { desk } from '$lib/nav/desk.svelte';
	import { t } from '$lib/i18n/catalog';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import PlayerLayer from '$lib/components/ui/PlayerLayer.svelte';
	import SearchField from '$lib/components/ui/SearchField.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import PreviewButton from './PreviewButton.svelte';
	import LookSheet from './LookSheet.svelte';
	import { PREVIEW_LOOK } from '$lib/picker/preview';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { button, CLIP, iconButton, SECTION_LABEL } from '$lib/components/ui/styles';
	import type { IconName } from '$lib/icons/icons';
	import { segments, shown, type PickGroup, type PickLine, type PickRow } from '$lib/picker/model';
	import { hereGroups } from '$lib/picker/elsewhere';
	import {
		createLead,
		doneLabel,
		emptyText,
		groupTitle,
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
		/** Desktop only: drawn 480 tall, as a Link popup level (a stacked level covers it). */
		level?: boolean;
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
		/**
		 * Link from other places (a group's pickers): while a search is typed,
		 * the group's own rows sit under `here`, then what the person's other
		 * places hold (`groups`, already matched by the server); `state` says
		 * whether they came. A tap or + on one of them is `onelsewhere`; only a
		 * linking picker's rows have the + (a field's or an act's: a tap).
		 */
		elsewhere?: {
			here: string;
			state: 'loading' | 'offline' | 'ready';
			groups: PickGroup[];
		} | null;
		/** A row from another place: a tap (`keep` false) or its + (`keep` true). */
		onelsewhere?: (row: PickRow, keep: boolean) => void;
		onpick: (row: PickRow) => void;
		onadd?: (row: PickRow) => void;
		onpreview?: (row: PickRow) => void;
		/** A row's picture was tapped (picker preview): its sheet. */
		onlook?: (row: PickRow) => void;
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
		level,
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
		elsewhere = null,
		onelsewhere,
		onpick,
		onadd,
		onpreview,
		onlook,
		oncreate,
		ondone,
		onclose
	}: Props = $props();

	/** The row whose preview sheet is open over the picker (picker preview), and whether it is from another place. */
	let looking = $state<{ row: PickRow; away: boolean } | null>(null);

	/** A row's picture was tapped: its preview sheet, the picker kept as it is underneath. */
	function look(r: PickRow, away = false) {
		if (onlook) return onlook(r);
		if (r.look) looking = { row: r, away };
	}

	/** The sheet's verb: exactly what a tap on its row does, then the sheet goes with the picker. */
	function pickLooked() {
		const l = looking;
		looking = null;
		if (!l) return;
		if (l.away) onelsewhere?.(l.row, false);
		else onpick(l.row);
	}

	let search: HTMLInputElement | undefined = $state();

	// Every opening starts with an empty search.
	$effect(() => {
		if (open) query = '';
	});

	// A picker that closes under its sheet (Android Back in the player) forgets it, so
	// the next opening shows the list, not the old sheet over it (picker preview).
	$effect(() => {
		if (!open) looking = null;
	});

	// Focus the search on desktop (no on-screen keyboard) or with a mouse: on a
	// phone the keyboard would cover the list, which is what the picker was opened to see.
	$effect(() => {
		if (search && !loading && !failed && (desk.current || matchMedia('(pointer: fine)').matches))
			search.focus();
	});

	const typed = $derived(query.trim());
	/** Other places show: a group's picker with something typed. */
	const others = $derived(elsewhere !== null && typed !== '');
	const lines = $derived(
		shown(
			others && elsewhere ? hereGroups(groups, elsewhere.here) : groups,
			prefiltered ? '' : query
		)
	);
	const otherGroups = $derived(
		others && elsewhere
			? elsewhere.groups.flatMap((g) => {
					const [lg] = lineGroups(shown([g], ''));
					return lg ? [{ group: g, lines: lg.lines }] : [];
				})
			: []
	);
	const failed = $derived(failure != null);
	const shows = $derived(pickerBody({ loading, failed, lines: lines.length }));
	// Decided once per opening: a prefiltered list shrinking as you type must not resize the sheet.
	let tallOpen = $state(false);
	$effect(() => {
		if (!open) tallOpen = false;
		else if (!loading)
			// A group's picker that can show other places opens tall: they come as you type.
			tallOpen = untrack(() => elsewhere !== null || pickerTall({ loading, failed, groups }));
	});
	const tall = $derived(loading ? true : tallOpen);
	const hasCreate = $derived(!!create && create.length > 0);
	const many = $derived(kind === 'field' && multi);
	const chosenCount = $derived(typeof chosen === 'object' && chosen ? chosen.size : 0);
	const hasDone = $derived(many || (kind === 'link' && added > 0));
	const showClear = $derived(many && !!clear && !typed && shows === 'list');

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

{#snippet row(r: PickRow, text: string, indent: boolean, last: boolean, away = false)}
	{@const trail = away
		? kind !== 'link'
			? 'none'
			: pending.has(r.key)
				? 'pending'
				: 'add'
		: rowTrail(kind, r, chosen, pending)}
	{@const linked = trail === 'linked'}
	{@const isChosen = trail === 'chosen'}
	<!-- `away`: a row from another place (link from other places): + copies it here and links. -->
	<div
		class="flex items-center has-[[data-pick]:active]:bg-step {indent ? 'pl-8' : 'pl-4'} {isChosen
			? 'bg-accent-soft'
			: ''}"
	>
		{#if r.preview}
			<button
				type="button"
				class="{iconButton('tonal')} mr-2.5"
				aria-label={t().picker.play(r.label)}
				onclick={() => onpreview?.(r)}><Icon name="play" size={18} filled /></button
			>
		{/if}
		{#if r.picture !== undefined && PREVIEW_LOOK === 'tile'}
			<!-- Picker preview: the figure's moving picture; a tap opens its sheet, the row still picks. -->
			<span class="mr-3 flex flex-none">
				<PreviewButton picture={r.picture} label={r.label} onclick={() => look(r, away)} />
			</span>
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
				aria-current={!many && isChosen ? 'true' : undefined}
				aria-pressed={many ? isChosen : undefined}
				onclick={() => (away ? onelsewhere?.(r, false) : onpick(r))}
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
			{#if r.picture !== undefined && PREVIEW_LOOK === 'eye'}
				<PreviewButton
					picture={r.picture}
					label={r.label}
					look="eye"
					onclick={() => look(r, away)}
				/>
			{/if}
			{#if trail === 'add'}
				<button
					type="button"
					class="{iconButton('bare', 'accent')} mr-1.5"
					aria-label={away ? t().picker.elsewhere.copyHere(r.label) : t().picker.addKeep(r.label)}
					onclick={() => (away ? onelsewhere?.(r, true) : onadd?.(r))}
					><Icon name="plus" size={24} /></button
				>
			{:else if trail === 'pending'}
				<span
					role="status"
					aria-label={t().picker.linking(r.label)}
					class="mr-1.5 flex size-11 flex-none items-center justify-center text-accent"
					><Spinner size={22} /></span
				>
			{:else if linked}
				<span
					class="flex flex-none items-center gap-1 pr-3 pl-1 text-[13px] font-bold whitespace-nowrap text-muted"
					><Icon name="check" size={16} />{t().picker.linked}</span
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
				aria-pressed={none}
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
			<span role="status" class="sr-only">{t().picker.loading}</span>
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
	{:else if shows === 'empty' && !others}
		<div role="status" class="flex flex-none items-start gap-3 rounded-2xl bg-surface p-4">
			<span class="mt-px flex-none text-muted"
				><Icon name={typed ? 'search' : emptyIcon} size={22} /></span
			>
			<div class="min-w-0 text-[15px] leading-[1.45] font-medium text-ink-2">
				{#if empty}{@render empty()}{:else}{emptyText(typed, nothingLeft)}{/if}
			</div>
		</div>
	{:else}
		{#if lines.length === 0 && elsewhere}
			<!-- Other places show: the group's own empty line stays one line. -->
			<h3 class={SECTION_LABEL}>{elsewhere.here}</h3>
			<p
				role="status"
				class="rounded-2xl bg-surface px-4 py-3.5 text-[15px] font-medium text-muted"
			>
				{t().picker.elsewhere.noneHere(typed)}
			</p>
		{/if}
		{#each lineGroups(lines) as g, gi (gi)}
			{@render block(g.title, g.lines, gi > 0, false)}
		{/each}
		{#if others && elsewhere}
			{#each otherGroups as o, oi (oi)}
				{@render block(o.group.title, o.lines, true, true, o.group.icon, o.group.tone)}
			{/each}
			{#if elsewhere.state !== 'ready'}
				<p
					role="status"
					class="mt-2.5 flex items-center gap-2 px-4 text-[14px] leading-[1.4] font-medium text-muted"
				>
					{#if elsewhere.state === 'loading'}<Spinner size={16} />{t().picker.elsewhere
							.looking}{:else}<Icon name="cloud-off" size={16} />{t().picker.elsewhere.offline}{/if}
				</p>
			{/if}
		{/if}
	{/if}
{/snippet}

{#snippet block(
	title: string,
	glines: { line: PickLine; last: boolean }[],
	gap: boolean,
	away: boolean,
	icon?: IconName,
	tone?: 'warn'
)}
	<h3 class="{groupTitle(tone)} {gap ? 'mt-2.5' : ''} flex items-center gap-1.5">
		{#if icon}<Icon name={icon} size={14} />{/if}{title}
	</h3>
	<div class="{CLIP} rounded-2xl bg-surface">
		{#each glines as { line, last }, i (i)}
			{#if line.kind === 'heading'}
				<!-- A heading, not a choice: only the rows under it can be picked. -->
				<p
					class="truncate px-4 pt-3.5 pb-0.5 text-[13px] leading-[1.3] font-extrabold tracking-[0.01em] text-ink-2"
				>
					{@render marked(line.text)}
				</p>
			{:else if line.kind === 'row'}
				{@render row(line.row, line.text, line.indent, last, away)}
			{/if}
		{/each}
	</div>
{/snippet}

{#snippet body()}
	<div class="flex min-h-0 flex-1 flex-col gap-2">
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
			<Banner kind="error" title={t().picker.refused} action={archived ? choices : undefined}
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
					>{#if archived.restoring}<Spinner /><span class="sr-only">{t().picker.restoring}</span
						>{:else}{t().picker.restore}{/if}</button
				>
			{/if}
			<button type="button" class={button('tertiary', 'sm')} onclick={archived.onpickanother}
				>{t().picker.pickAnother}</button
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
					>{#if creating}<Spinner size={18} /><span class="sr-only">{t().picker.creating}</span
						>{:else}<Icon name="plus" size={18} />{m.label}{/if}</button
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

{#if looking?.row.look}
	{@const l = looking}
	{@const lk = looking.row.look}
	<!-- Picker preview: the row's sheet, a level over the picker (S1). -->
	<LookSheet
		open={open && looking !== null}
		look={lk}
		label={l.row.label}
		picture={l.row.picture ?? null}
		verb={kind === 'act' ? 'act' : kind === 'link' ? 'link' : 'field'}
		linked={l.row.linked === true}
		{theme}
		z="z-[60]"
		{level}
		onpick={pickLooked}
		onclose={() => (looking = null)}
	/>
{/if}

{#if theme === 'dark'}
	{#if open}
		<!-- Inside the player's <dialog>: an overlay, not a second top-layer dialog. -->
		<PlayerLayer
			{title}
			{sub}
			{back}
			{z}
			{tall}
			fill
			{level}
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
		fill
		{level}
		footer={hasCreate || hasDone ? footer : undefined}
	>
		{@render body()}
	</Sheet>
{/if}
