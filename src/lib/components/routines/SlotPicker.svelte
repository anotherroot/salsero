<script lang="ts">
	/**
	 * The one picker behind every way of adding: a seam's ↓+ / ↑+, the + at
	 * either end, Add above / below, and + Alternative. One tap inserts and
	 * closes — there is no confirm step. The sheet is the shared Picker; what
	 * fits (and the Count / Hold chips) stays here, in fit.ts.
	 */
	import Picker from '$lib/components/picker/Picker.svelte';
	import type { PickGroup as Group, PickHeading, PickRow } from '$lib/picker/model';
	import {
		anchorText,
		pickList,
		variationName,
		type Anchor,
		type Candidate
	} from '$lib/routines/fit';

	interface Props {
		open: boolean;
		title: string;
		anchor: Anchor;
		candidates: Candidate[];
		positionName: (id: number) => string;
		onpick: (c: Candidate) => void;
		onclose: () => void;
	}

	let { open, title, anchor, candidates, positionName, onpick, onclose }: Props = $props();

	let query = $state('');
	let count = $state(true);
	let hold = $state(true);

	// Every opening starts clean: both filters on (Picker clears the search).
	$effect(() => {
		if (!open) return;
		count = true;
		hold = true;
	});

	const list = $derived(pickList(candidates, anchor, { count, hold, query }));
	const context = $derived(anchorText(anchor, positionName));

	const emptyText = $derived.by(() => {
		if (anchor.kind === 'alternative') return 'No other figure starts and lands like this one.';
		if (query.trim() !== '' && list.emptiedBy.length === 0)
			return `Nothing matches “${query.trim()}”.`;
		if (context) return `Nothing you know ${context[0].toLowerCase()}${context.slice(1)}.`;
		return 'No figures in this dance yet.';
	});

	/**
	 * "1→1 · Closed → Open": the counts it starts and ends on, then where the
	 * hands start and where they end. Both ends, because a figure is chosen as
	 * much for where it begins as for where it lands — and the count filter can
	 * be off.
	 */
	function meta(c: Candidate): string {
		const timing = `${c.startCounts.join('/') || '?'}→${c.next ?? '?'}`;
		const from = c.starts.length > 0 ? c.starts.map(positionName).join(' / ') : '?';
		const to = c.end === null ? '?' : positionName(c.end);
		return `${timing} · ${from} → ${to}`;
	}

	const row = (c: Candidate, short?: string): PickRow => ({
		key: `${c.kind}:${c.id}`,
		value: c.id,
		label: c.label,
		short,
		meta: meta(c)
	});

	// fit.ts has already filtered by query and chips: these are the groups as shown.
	const groups = $derived.by(() => {
		const out: Group[] = [];
		if (list.figures.length > 0) {
			out.push({
				title: 'Figures',
				entries: list.figures.map((g): PickHeading => ({
					heading: g.name,
					collapse: g.single,
					rows: g.variations.map((v) => row(v, variationName(v)))
				}))
			});
		}
		if (list.routines.length > 0) {
			out.push({ title: 'Routines', entries: list.routines.map((r) => row(r)) });
		}
		return out;
	});

	function pick(r: PickRow) {
		const c = candidates.find((x) => `${x.kind}:${x.id}` === r.key);
		if (c) onpick(c);
	}

	const chip = (on: boolean) =>
		`h-8 rounded-full border px-3 text-[13px] ${
			on ? 'border-accent bg-accent/10 font-medium text-accent' : 'border-line bg-raised text-muted'
		}`;
</script>

<Picker
	{open}
	{title}
	placeholder="Search figures and routines"
	{groups}
	kind="act"
	prefiltered
	bind:query
	nothingLeft={emptyText}
	onpick={pick}
	{onclose}
>
	{#snippet top()}
		{#if context}
			<p class="mt-2 text-[13px] text-ink-2">{context}</p>
		{/if}
		{#if list.toggles.count || list.toggles.hold}
			<div class="mt-2 flex gap-2">
				{#if list.toggles.count}
					<button
						type="button"
						class={chip(count)}
						aria-pressed={count}
						onclick={() => (count = !count)}>{count ? '✓ ' : ''}Count</button
					>
				{/if}
				{#if list.toggles.hold}
					<button
						type="button"
						class={chip(hold)}
						aria-pressed={hold}
						onclick={() => (hold = !hold)}>{hold ? '✓ ' : ''}Hold</button
					>
				{/if}
			</div>
		{/if}
	{/snippet}
	{#snippet empty()}
		{emptyText}
		{#if list.emptiedBy.includes('hold')}
			<button type="button" class="font-semibold text-accent" onclick={() => (hold = false)}
				>Turn off Hold</button
			> to see the rest.
		{:else if list.emptiedBy.includes('count')}
			<button type="button" class="font-semibold text-accent" onclick={() => (count = false)}
				>Turn off Count</button
			> to see the rest.
		{/if}
	{/snippet}
</Picker>
