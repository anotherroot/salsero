<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { refreshWhenSettled } from '$lib/sheets/history.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { GROUP, button } from '$lib/components/ui/styles';
	import {
		loadAgain,
		nothingDiffers,
		pickOne,
		showAll,
		syncLabel,
		showLess,
		syncLoadFailed,
		syncSendFailed,
		syncTo,
		updateMine,
		notSynced,
		notesOnLoad,
		nothingNew,
		openKeys,
		pullable,
		placeShown,
		postPicks,
		sheetRows,
		staysLine,
		syncButton,
		syncSub,
		updateSub,
		type SheetRow
	} from '$lib/clones/step-view';
	import { syncPick, changedLabels } from '$lib/clones/view';
	import type { CloneKind, SyncView } from '$lib/types';

	/**
	 * Sync (spec 2026-11-07, 3A): every difference between the page's copy and
	 * the other copies the person reads, a row each, merged like a git merge,
	 * then "Sync to" (every copy they edit, ticked) and one button. A reader
	 * gets "Update from <club>": what lands on their own copy, what of theirs
	 * stays, and Update mine. Fetched on each open; the form posts a pick for
	 * every row and every copy's digest, so nothing lands that was not shown
	 * (a copy changed since is refused with its words, and Load again reads
	 * the sheet anew).
	 */
	let {
		open,
		onclose,
		kind,
		id,
		action = '?/sync',
		only = null,
		onsynced
	}: {
		open: boolean;
		onclose: () => void;
		kind: CloneKind;
		/** The page's row: "yours" in the sheet. */
		id: number;
		/** Where the form posts (the page's own `sync` action by default). */
		action?: string;
		/** Tick only this copy in "Sync to" (Drop my copy's Sync first). */
		only?: number | null;
		/** Every ticked copy landed: called in place of closing and refreshing. */
		onsynced?: () => void;
	} = $props();

	const uid = $props.id();
	let view = $state<SyncView | null>(null);
	let failed = $state(false);
	/** The person's own picks, by row key, over the preselection. */
	let picks = $state<Record<string, string | null>>({});
	let ticked = $state<Record<number, boolean>>({});
	let busy = $state(false);
	let refused = $state<string | null>(null);
	/** The sheet is out of date: Load again reads it anew. */
	let stale = $state(false);
	/** Copies a Sync landed without, with why. */
	let missed = $state<string[]>([]);
	let opened = $state<Record<string, boolean>>({});
	let loads = $state(0);
	/** Why the next load runs: a fresh open, Load again, or the reload after a Sync. Not state. */
	let why: 'open' | 'again' | 'after-sync' = 'open';
	function reload(reason: 'again' | 'after-sync') {
		why = reason;
		loads++;
	}

	function load(signal: AbortSignal) {
		view = null;
		failed = false;
		const q = new URLSearchParams({ kind, id: String(id) });
		fetch(`/api/clones/sync?${q}`, { signal })
			.then(async (res) => {
				if (!res.ok) throw new Error(String(res.status));
				const v = (await res.json()) as SyncView;
				view = v;
				picks = {};
				opened = {};
				ticked = Object.fromEntries(
					v.targets.map((t) => [t.id, only === null ? t.ticked : t.id === only])
				);
			})
			.catch(() => {
				if (!signal.aborted) failed = true;
			});
	}

	/** Fetched on each open (and on Load again): what is posted as `seen` is what the sheet shows. */
	$effect(() => {
		if (!open) return;
		void loads;
		const ask = new AbortController();
		// What the sheet still says: the copies a Sync just missed survive its reload.
		const notes = notesOnLoad(
			untrack(() => ({ refused, stale, missed })),
			why
		);
		why = 'open';
		refused = notes.refused;
		stale = notes.stale;
		missed = notes.missed;
		load(ask.signal);
		return () => ask.abort();
	});

	const rows = $derived(view ? sheetRows(view) : []);
	const waiting = $derived(view ? openKeys(view.rows, picks) : []);
	const targets = $derived((view?.targets ?? []).filter((t) => ticked[t.id]));
	const update = $derived(view?.mode === 'update');
	const changes = $derived(rows.filter((r) => r.kind !== 'stays').length);
	const stays = $derived(
		changedLabels(
			rows.filter((r) => r.kind === 'stays').map((r) => ({ key: r.key, label: r.label }))
		)
	);
	/** Update mine with nothing the club has that the reader's copy lacks: only their own changes. */
	const nothing = $derived(update && view !== null && view.rows.length > 0 && !pullable(rows));
	const ready = $derived(
		!!view &&
			view.rows.length > 0 &&
			!nothing &&
			waiting.length === 0 &&
			targets.length > 0 &&
			!stale
	);

	/** The row's current choice: the person's pick, else the preselection; undefined while open. */
	function choice(key: string): string | null | undefined {
		if (Object.hasOwn(picks, key)) return picks[key];
		return view?.rows.find((r) => r.key === key)?.pick;
	}
	function pick(key: string, hash: string | null) {
		picks = { ...picks, [key]: hash };
		refused = null;
	}
	/** A tile shortened to where the values part, or too long to show whole: Show all. */
	const tooLong = (t: string) => t.length > 120 || t.split('\n').length > 3;
	const isLong = (r: SheetRow) =>
		r.kind === 'pick' && r.tiles.some((t) => t.text !== t.full || tooLong(t.text));

	const TILE =
		'relative flex min-h-14 cursor-pointer flex-col gap-0.5 rounded-xl border-2 bg-surface py-2.5 pr-9 pl-3 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent';
	function tileLook(key: string, hash: string | null): string {
		const c = choice(key);
		if (c === undefined) return 'border-dashed border-warn';
		return c === hash ? 'border-accent' : 'border-hairline';
	}
	const BOX = 'size-[22px] flex-none';
</script>

<Sheet
	title={view?.title ?? syncLabel()}
	sub={view && view.rows.length > 0 && !nothing
		? update
			? updateSub(changes)
			: syncSub(view.rows.length, view.members.length)
		: undefined}
	{open}
	{onclose}
	tall
>
	<div class="flex flex-col gap-4">
		{#each missed as m (m)}<Banner kind="error">{m}</Banner>{/each}
		{#if refused && stale}
			<Banner kind="error">
				{refused}
				{#snippet action()}
					<button type="button" class={button('tertiary', 'sm')} onclick={() => reload('again')}
						>{loadAgain()}</button
					>
				{/snippet}
			</Banner>
		{:else if refused}
			<Banner kind="error">{refused}</Banner>
		{/if}
		{#if failed}
			<Banner kind="error">
				{syncLoadFailed()}
				{#snippet action()}
					<button type="button" class={button('tertiary', 'sm')} onclick={() => reload('again')}
						>{loadAgain()}</button
					>
				{/snippet}
			</Banner>
		{:else if !view}
			<div class="grid place-items-center py-10 text-muted"><Spinner /></div>
		{:else if view.rows.length === 0}
			<p class="rounded-2xl bg-surface px-4 py-3.5 text-[15px] text-ink-2">{nothingDiffers()}</p>
		{:else}
			{#if nothing}
				<p class="rounded-2xl bg-surface px-4 py-3.5 text-[15px] text-ink-2">
					{nothingNew(view.from ?? '')}
				</p>
			{/if}
			{@const lines = rows.filter((r) => r.kind === 'change')}
			{#if lines.length > 0}
				<ul class={GROUP}>
					{#each lines as r (r.key)}
						{#if r.kind === 'change'}
							<li class="flex items-baseline gap-3 px-4 py-2.5 text-[15px] leading-snug">
								<span class="w-20 flex-none text-[13px] font-bold text-muted">{r.label}</span>
								<span class="min-w-0 flex-1 break-words text-ink">{r.text}</span>
							</li>
						{/if}
					{/each}
				</ul>
			{/if}
			{#if stays.length > 0}
				<p class="px-1 text-[14px] leading-snug text-muted">{staysLine(stays)}</p>
			{/if}
			{#each rows as r, i (r.key)}
				{#if r.kind === 'pick'}
					{@const c = choice(r.key)}
					{@const long = isLong(r)}
					<section class="flex flex-col gap-1.5" aria-labelledby="{uid}-{i}">
						<h3 id="{uid}-{i}" class="px-1 text-[13px] leading-snug">
							<span class="font-extrabold tracking-wide text-muted uppercase">{r.label}</span>
							{#if c === undefined}
								<span class="font-bold text-warn"> · {r.by ?? pickOne()}</span>
							{:else if r.by}
								<span class="font-bold text-status"> · {r.by}</span>
							{/if}
						</h3>
						<div class="flex flex-col gap-2" role="radiogroup" aria-labelledby="{uid}-{i}">
							{#each r.tiles as t (t.hash ?? 'absent')}
								<label class="{TILE} {tileLook(r.key, t.hash)}">
									<input
										type="radio"
										class="sr-only"
										name="{uid}-pick-{i}"
										checked={c === t.hash}
										onchange={() => pick(r.key, t.hash)}
									/>
									<span
										class="absolute top-2.5 right-2.5 grid size-5 place-items-center rounded-full {c ===
										t.hash
											? 'bg-accent text-on-accent'
											: 'border-2 border-field-line'}"
										aria-hidden="true"
										>{#if c === t.hash}<Icon name="check" size={14} stroke={3} />{/if}</span
									>
									<span class="text-[12px] leading-tight font-bold text-muted">{t.who}</span>
									<span
										class="text-[15px] leading-snug break-words whitespace-pre-line {t.absent
											? 'font-semibold text-danger'
											: 'text-ink'} {long && !opened[r.key] ? 'line-clamp-4' : ''}"
										>{opened[r.key] ? t.full : t.text}</span
									>
								</label>
							{/each}
						</div>
						{#if long}
							<button
								type="button"
								class="self-start px-1 py-1 text-[13px] font-extrabold text-accent-text"
								aria-expanded={!!opened[r.key]}
								onclick={() => (opened = { ...opened, [r.key]: !opened[r.key] })}
								>{opened[r.key] ? showLess() : showAll()}</button
							>
						{/if}
					</section>
				{:else if r.kind === 'box'}
					<section class="flex flex-col gap-1.5" aria-labelledby="{uid}-{i}">
						<h3 id="{uid}-{i}" class="px-1 text-[13px] leading-snug">
							<span class="font-extrabold tracking-wide text-muted uppercase">{r.label}</span>
							{#if r.by}<span class="font-bold text-status"> · {r.by}</span>{/if}
						</h3>
						<label
							class="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 border-hairline bg-surface px-3 py-2.5"
						>
							<input
								type="checkbox"
								class={BOX}
								style="accent-color: var(--color-accent)"
								checked={choice(r.key) === r.on}
								onchange={(e) => pick(r.key, e.currentTarget.checked ? r.on : r.off)}
							/>
							<span class="min-w-0 flex-1 text-[15px] leading-snug text-ink">{r.text}</span>
						</label>
					</section>
				{/if}
			{/each}
			{#if !update}
				<section class="flex flex-col gap-1.5" aria-labelledby="{uid}-to">
					<h3
						id="{uid}-to"
						class="px-1 text-[13px] leading-snug font-extrabold tracking-wide text-muted uppercase"
					>
						{syncTo()}
					</h3>
					<ul class={GROUP}>
						{#each view.targets as t (t.id)}
							<li>
								<label class="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2">
									<input
										type="checkbox"
										class={BOX}
										style="accent-color: var(--color-accent)"
										checked={ticked[t.id] ?? false}
										onchange={(e) => (ticked = { ...ticked, [t.id]: e.currentTarget.checked })}
									/>
									<span class="min-w-0 flex-1 text-[15px] leading-snug">
										<span class="font-bold text-ink">{placeShown(t.label)}</span>
										{#if t.role}<span class="text-muted"> · {t.role}</span>{/if}
									</span>
								</label>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		{/if}
	</div>

	{#snippet footer()}
		<form
			method="POST"
			{action}
			class="flex flex-col gap-2"
			use:enhance={({ cancel }) => {
				// One Sync per tap: a second tap while the first is out is dropped.
				if (busy || !ready) return cancel();
				busy = true;
				refused = null;
				missed = [];
				return async ({ result }) => {
					try {
						if (result.type === 'success') {
							const data = result.data as
								{ refused?: { id: number; message: string }[] } | undefined;
							const left = data?.refused ?? [];
							if (left.length === 0) {
								if (onsynced) onsynced();
								else {
									onclose();
									await refreshWhenSettled();
								}
								return;
							}
							// The others landed: say which did not, and read the sheet anew.
							const name = (cid: number) => view?.targets.find((t) => t.id === cid)?.label ?? '';
							missed = left.map((r) => notSynced(name(r.id), r.message));
							reload('after-sync');
						} else if (result.type === 'failure') {
							const data = result.data as { message?: unknown; reason?: unknown } | undefined;
							refused = typeof data?.message === 'string' ? data.message : syncSendFailed();
							stale = data?.reason === 'stale';
						} else {
							refused = syncSendFailed();
						}
					} finally {
						busy = false;
					}
				};
			}}
		>
			<input
				type="hidden"
				name="picks"
				value={JSON.stringify(view ? postPicks(view.rows, picks) : {})}
			/>
			<input
				type="hidden"
				name="targets"
				value={JSON.stringify(targets.map((t) => ({ id: t.id, seen: t.seen })))}
			/>
			<input
				type="hidden"
				name="members"
				value={JSON.stringify((view?.members ?? []).map((m) => ({ id: m.id, seen: m.seen })))}
			/>
			<button
				type="submit"
				class={button('primary', 'md', true)}
				disabled={!ready}
				aria-busy={busy}
				aria-describedby={waiting.length > 0 ? `${uid}-hint` : undefined}
			>
				{#if busy}<Spinner />{:else}<Icon name="refresh" size={20} />{update
						? updateMine()
						: syncButton(targets.length)}{/if}
			</button>
			{#if waiting.length > 0}
				<p id="{uid}-hint" class="text-center text-[13px] text-muted">{syncPick()}</p>
			{/if}
		</form>
	{/snippet}
</Sheet>
