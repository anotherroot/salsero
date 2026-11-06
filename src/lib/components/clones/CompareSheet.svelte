<script lang="ts">
	import { enhance } from '$app/forms';
	import { refreshWhenSettled } from '$lib/sheets/history.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { button } from '$lib/components/ui/styles';
	import { unpicked } from '$lib/clones/diff';
	import {
		ALL_THEIRS,
		ALL_YOURS,
		CANCEL,
		COMPARE_FAILED,
		IN_STEP,
		SHOW_ALL,
		SHOW_LESS,
		TAKE_FAILED,
		columnNames,
		compareSub,
		compareTitle,
		diffWhy,
		isLong,
		keepHint,
		mergeButton,
		optionShow,
		pickFirst
	} from '$lib/clones/view';
	import type { CloneKind, Comparison, FieldDiff, Picks } from '$lib/types';

	/**
	 * Merge with the member a copy came from (merge sheets spec): two columns,
	 * yours and theirs, one row per difference since the two were last in
	 * step, picked like a merge tool. What only they changed starts on theirs,
	 * what only you changed on yours, a removal on yours; a field you both
	 * changed waits for a side, and the button with it. A column's header picks
	 * that whole side. Nothing picked theirs is Keep mine: no field changes,
	 * only the pair's snapshot. A refusal (changed since, a name taken, a
	 * linked section, no room) shows here. The comparison is fetched each time
	 * the sheet opens, so `seen` is what the person is looking at.
	 */
	let {
		open,
		onclose,
		kind,
		mineId,
		theirsId,
		place,
		action = '?/take'
	}: {
		open: boolean;
		onclose: () => void;
		kind: CloneKind;
		/** The page's row: what Take writes into. */
		mineId: number;
		/** The member to compare with. */
		theirsId: number;
		/** Its place's name: "Salsa Tuesdays". */
		place: string;
		/** Where the form posts. */
		action?: string;
	} = $props();

	const uid = $props.id();
	let comparison = $state<Comparison | null>(null);
	let failed = $state(false);
	let picks = $state<Picks>({});
	let busy = $state(false);
	let refused = $state<string | null>(null);
	/** Rows whose long values show whole, by key. */
	let opened = $state<Record<string, boolean>>({});

	/** Fetched on each open: what Take sends as `seen` is what this sheet shows. */
	$effect(() => {
		if (!open) return;
		const ask = new AbortController();
		comparison = null;
		failed = false;
		refused = null;
		opened = {};
		const q = new URLSearchParams({ kind, mine: String(mineId), theirs: String(theirsId) });
		fetch(`/api/clones/compare?${q}`, { signal: ask.signal })
			.then(async (res) => {
				if (!res.ok) throw new Error(String(res.status));
				const c = (await res.json()) as Comparison;
				comparison = c;
				picks = { ...c.picks };
			})
			.catch(() => {
				if (!ask.signal.aborted) failed = true;
			});
		return () => ask.abort();
	});

	const col = $derived(columnNames(place));
	const diffs = $derived(comparison?.diffs ?? []);
	const canTake = $derived(comparison?.canTake ?? false);
	const openKeys = $derived(unpicked(diffs, picks));
	const waiting = $derived(!comparison || openKeys.length > 0);
	const fromTheirs = $derived(diffs.filter((d) => picks[d.key] === 'theirs').length);
	const allOn = (side: 'mine' | 'theirs') =>
		diffs.length > 0 && diffs.every((d) => picks[d.key] === side);
	const hint = $derived(
		!canTake || !comparison
			? null
			: waiting
				? pickFirst(diffs.filter((d) => openKeys.includes(d.key)).map((d) => d.label))
				: fromTheirs === 0
					? keepHint(place)
					: null
	);

	function pick(d: FieldDiff, side: 'mine' | 'theirs') {
		picks = { ...picks, [d.key]: side };
		refused = null;
	}

	function pickAll(side: 'mine' | 'theirs') {
		picks = Object.fromEntries(diffs.map((d) => [d.key, side]));
		refused = null;
	}

	const WHY: Record<'mine' | 'theirs' | 'both', string> = {
		mine: 'text-muted',
		theirs: 'text-accent-text',
		both: 'text-warn'
	};
	const HEAD =
		'flex min-h-12 cursor-pointer flex-col items-center justify-center rounded-xl border-2 bg-surface px-2 py-1.5 text-center leading-tight disabled:cursor-default';
	const TILE =
		'relative flex min-h-14 cursor-pointer flex-col rounded-xl border-2 bg-surface py-2.5 pr-8 pl-3 has-disabled:cursor-default has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent';
	function tileLook(d: FieldDiff, side: 'mine' | 'theirs'): string {
		const p = picks[d.key];
		if (!p) return 'border-dashed border-warn';
		return p === side ? 'border-accent' : 'border-transparent opacity-50';
	}
</script>

<Sheet
	title={compareTitle(place)}
	sub={comparison ? compareSub(comparison.synced, comparison.diffs.length) : undefined}
	{open}
	{onclose}
	tall
>
	<div class="flex flex-col gap-4">
		{#if refused}<Banner kind="error">{refused}</Banner>{/if}
		{#if failed}
			<Banner kind="error">{COMPARE_FAILED}</Banner>
		{:else if !comparison}
			<div class="grid place-items-center py-10 text-muted"><Spinner /></div>
		{:else if comparison.diffs.length === 0}
			<p class="rounded-2xl bg-surface px-4 py-3.5 text-[15px] text-ink-2">{IN_STEP}</p>
		{:else}
			<div class="grid grid-cols-2 gap-2">
				{#each [{ side: 'mine' as const, name: col.mine, sub: ALL_YOURS }, { side: 'theirs' as const, name: col.theirs, sub: ALL_THEIRS }] as h (h.side)}
					<button
						type="button"
						class="{HEAD} {allOn(h.side) ? 'border-accent' : 'border-hairline'}"
						disabled={!canTake}
						aria-pressed={allOn(h.side)}
						onclick={() => pickAll(h.side)}
					>
						<span
							class="text-[15px] font-extrabold {allOn(h.side) ? 'text-accent-text' : 'text-ink'}"
							>{h.name}</span
						>
						{#if canTake}<span class="text-[12px] font-semibold text-muted">{h.sub}</span>{/if}
					</button>
				{/each}
			</div>
			{#each comparison.diffs as d, i (d.key)}
				{@const why = diffWhy(d, !!picks[d.key])}
				{@const long = isLong(d.mine?.show ?? '') || isLong(d.theirs?.show ?? '')}
				<section class="flex flex-col gap-1.5" aria-labelledby="{uid}-{i}">
					<h3 id="{uid}-{i}" class="px-1 text-[13px] leading-snug">
						<span class="font-extrabold tracking-wide text-muted uppercase">{d.label}</span>
						<span class="font-bold {WHY[why.tone]}"> · {why.text}</span>
					</h3>
					<div class="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="{uid}-{i}">
						{#each [{ side: 'mine' as const, name: col.mine, field: d.mine }, { side: 'theirs' as const, name: col.theirs, field: d.theirs }] as o (o.side)}
							<label class="{TILE} {tileLook(d, o.side)}">
								<input
									type="radio"
									class="sr-only"
									name="{uid}-pick-{i}"
									checked={picks[d.key] === o.side}
									disabled={!canTake}
									onchange={() => pick(d, o.side)}
								/>
								<span
									class="absolute top-2 right-2 grid size-5 place-items-center rounded-full {picks[
										d.key
									] === o.side
										? 'bg-accent text-on-accent'
										: 'border-2 border-field-line'}"
									aria-hidden="true"
									>{#if picks[d.key] === o.side}<Icon
											name="check"
											size={14}
											stroke={3}
										/>{/if}</span
								>
								<span class="sr-only">{o.name}: </span>
								<span
									class="text-[15px] leading-snug break-words whitespace-pre-line {o.field
										? 'text-ink'
										: 'text-muted'} {long && !opened[d.key] ? 'line-clamp-3' : ''}"
									>{optionShow(o.field, o.side)}</span
								>
							</label>
						{/each}
					</div>
					{#if long}
						<button
							type="button"
							class="self-start px-1 py-1 text-[13px] font-extrabold text-accent-text"
							aria-expanded={!!opened[d.key]}
							onclick={() => (opened = { ...opened, [d.key]: !opened[d.key] })}
							>{opened[d.key] ? SHOW_LESS : SHOW_ALL}</button
						>
					{/if}
				</section>
			{/each}
		{/if}
	</div>

	{#snippet footer()}
		<form
			method="POST"
			{action}
			class="grid grid-cols-[1fr_2fr] gap-2"
			use:enhance={({ cancel }) => {
				// One take per tap: a second tap while the first is out is dropped.
				if (busy || !comparison) return cancel();
				busy = true;
				refused = null;
				return async ({ result }) => {
					try {
						if (result.type === 'success') {
							onclose();
							await refreshWhenSettled();
						} else if (result.type === 'failure') {
							const data = result.data as { message?: unknown } | undefined;
							refused = typeof data?.message === 'string' ? data.message : TAKE_FAILED;
						} else {
							refused = TAKE_FAILED;
						}
					} finally {
						busy = false;
					}
				};
			}}
		>
			<input type="hidden" name="from" value={theirsId} />
			<input type="hidden" name="picks" value={JSON.stringify(picks)} />
			<input type="hidden" name="seen" value={comparison?.seen ?? ''} />
			<button type="button" class={button('tertiary', 'md', true)} onclick={onclose}
				>{CANCEL}</button
			>
			<button
				type="submit"
				class={button('primary', 'md', true)}
				disabled={!canTake || waiting || diffs.length === 0}
				aria-busy={busy}
				aria-describedby={hint ? `${uid}-hint` : undefined}
			>
				{#if busy}<Spinner />{:else}<Icon
						name={fromTheirs === 0 ? 'check' : 'download'}
						size={20}
					/>{mergeButton(fromTheirs)}{/if}
			</button>
			{#if hint}
				<p id="{uid}-hint" class="col-span-2 text-center text-[13px] text-muted">{hint}</p>
			{/if}
		</form>
	{/snippet}
</Sheet>
