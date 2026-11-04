<script lang="ts">
	import { enhance } from '$app/forms';
	import { refreshWhenSettled } from '$lib/sheets/history.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { button } from '$lib/components/ui/styles';
	import { unpicked } from '$lib/clones/diff';
	import {
		COMPARE_FAILED,
		IN_STEP,
		TAKE_BUTTON,
		TAKE_FAILED,
		THEIRS,
		YOURS,
		compareSub,
		compareTitle,
		diffTag,
		optionShow
	} from '$lib/clones/view';
	import type { CloneKind, Comparison, FieldDiff, Picks } from '$lib/types';

	/**
	 * Compare with the member a copy came from (board C2 p3): one card per
	 * difference since the two were last in step, Yours or Theirs, the picked
	 * one outlined. Take preselects what only theirs changed; a removal and a
	 * name keep yours until tapped; a field both changed has no pick until
	 * tapped, and Take waits for it. "Take what’s picked" writes theirs into
	 * yours in place; a refusal (changed since, a name taken, a linked
	 * section, no room) shows here. The comparison is fetched each time the
	 * sheet opens, so `seen` is what the person is looking at.
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

	/** Fetched on each open: what Take sends as `seen` is what this sheet shows. */
	$effect(() => {
		if (!open) return;
		const ask = new AbortController();
		comparison = null;
		failed = false;
		refused = null;
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

	const waiting = $derived(comparison ? unpicked(comparison.diffs, picks).length > 0 : true);

	function pick(d: FieldDiff, side: 'mine' | 'theirs') {
		picks = { ...picks, [d.key]: side };
		refused = null;
	}

	const tone = (d: FieldDiff) =>
		d.side === 'both' ? 'warn' : d.side === 'theirs' ? 'accent' : 'neutral';

	const OPTION =
		'flex min-h-14 cursor-pointer flex-col gap-0.5 rounded-xl border-2 border-transparent bg-step px-3 py-2.5 has-checked:border-accent has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent';
	const CAPTION = 'text-[12px] font-bold tracking-wide text-muted uppercase';
</script>

<Sheet
	title={compareTitle(place)}
	sub={comparison ? compareSub(comparison.synced) : undefined}
	{open}
	{onclose}
	tall
>
	<div class="flex flex-col gap-3">
		{#if refused}<Banner kind="error">{refused}</Banner>{/if}
		{#if failed}
			<Banner kind="error">{COMPARE_FAILED}</Banner>
		{:else if !comparison}
			<div class="grid place-items-center py-10 text-muted"><Spinner /></div>
		{:else if comparison.diffs.length === 0}
			<p class="rounded-2xl bg-surface px-4 py-3.5 text-[15px] text-ink-2">{IN_STEP}</p>
		{:else}
			{#each comparison.diffs as d, i (d.key)}
				<section
					class="flex flex-col gap-2.5 rounded-2xl bg-surface p-4"
					aria-labelledby="{uid}-{i}"
				>
					<div class="flex items-center gap-2">
						<h3 id="{uid}-{i}" class="min-w-0 flex-1 text-[15px] font-extrabold text-ink">
							{d.label}
						</h3>
						<Badge tone={tone(d)}>{diffTag(d)}</Badge>
					</div>
					<div class="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="{uid}-{i}">
						{#each [{ side: 'mine' as const, caption: YOURS, field: d.mine }, { side: 'theirs' as const, caption: THEIRS, field: d.theirs }] as o (o.side)}
							<label class={OPTION}>
								<input
									type="radio"
									class="sr-only"
									name="{uid}-pick-{i}"
									checked={picks[d.key] === o.side}
									disabled={!comparison.canTake}
									onchange={() => pick(d, o.side)}
								/>
								<span class={CAPTION}>{o.caption}</span>
								<span
									class="text-[15px] leading-snug break-words whitespace-pre-line {o.field
										? 'text-ink'
										: 'text-muted'}">{optionShow(o.field, o.side)}</span
								>
							</label>
						{/each}
					</div>
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
			<button type="button" class={button('tertiary', 'md', true)} onclick={onclose}>Cancel</button>
			<button
				type="submit"
				class={button('primary', 'md', true)}
				disabled={!comparison?.canTake || comparison.diffs.length === 0 || waiting}
				aria-busy={busy}
			>
				{#if busy}<Spinner />{:else}<Icon name="download" size={20} />{TAKE_BUTTON}{/if}
			</button>
		</form>
	{/snippet}
</Sheet>
