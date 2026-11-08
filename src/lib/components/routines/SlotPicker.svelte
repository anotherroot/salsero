<script lang="ts">
	/**
	 * The one picker behind every way of adding: a seam's ↓+ / ↑+, the + at
	 * either end, Add above / below, and + Alternative. One tap inserts and
	 * closes — there is no confirm step. The sheet is the shared Picker; what
	 * fits (and the Count / Hold chips) stays here, in fit.ts.
	 */
	import Icon from '$lib/components/ui/Icon.svelte';
	import { t } from '$lib/i18n/catalog';
	import { moveHeading, usedAsIs } from '$lib/clones/view';
	import { twinPickMeta } from '$lib/clones/twins';
	import { CHIP } from '$lib/components/ui/styles';
	import Picker from '$lib/components/picker/Picker.svelte';
	import type { PickGroup as Group, PickHeading, PickRow } from '$lib/picker/model';
	import {
		groupTags,
		anchorText,
		pickList,
		variationName,
		type Anchor,
		type Candidate
	} from '$lib/routines/fit';
	import { handsLine } from '$lib/routines/page';

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

	const RESCUE =
		'min-h-6 cursor-pointer font-extrabold text-accent-text underline underline-offset-[3px]';

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
		if (anchor.kind === 'alternative') return t().routine.picker.noAlternative;
		if (query.trim() !== '' && list.emptiedBy.length === 0)
			return t().routine.picker.noMatch(query.trim());
		if (context) return t().routine.picker.nothingFits(context);
		return t().routine.picker.noFigures;
	});

	/**
	 * "1→1 · Closed → Open": the counts it starts and ends on, then where the
	 * hands start and where they end. Both ends, because a figure is chosen as
	 * much for where it begins as for where it lands — and the count filter can
	 * be off. Each side's positions are joined " or " (`handsLine`); an untagged
	 * side shows nothing (it fits anywhere); both untagged, just the counts.
	 */
	function meta(c: Candidate): string {
		const timing = `${c.startCounts.join('/') || '?'}→${c.next ?? '?'}`;
		const hands = handsLine(c.starts, c.ends, positionName);
		const where = hands === '' ? timing : `${timing} · ${hands}`;
		if (c.twins && c.twins.length > 0) return `${twinPickMeta(c, c.twins)} · ${where}`;
		return c.team ? `${usedAsIs(c.team.name)} · ${where}` : where;
	}

	const row = (c: Candidate, short?: string, tag?: string): PickRow => ({
		key: `${c.kind}:${c.id}`,
		value: c.id,
		label: tag ? `${c.label} ${tag}` : c.label,
		short: short && tag ? `${short} ${tag}` : short,
		meta: meta(c)
	});

	// fit.ts has already filtered by query and chips: these are the groups as shown.
	const groups = $derived.by(() => {
		const out: Group[] = [];
		if (list.figures.length > 0) {
			out.push({
				title: t().moves.segments.figures,
				entries: list.figures.map((g): PickHeading => {
					const tags = groupTags(g);
					return {
						heading: moveHeading(g.name, g.team),
						collapse: g.single,
						rows: g.variations.map((v) => row(v, variationName(v), tags.get(v.id)))
					};
				})
			});
		}
		if (list.routines.length > 0) {
			out.push({ title: t().moves.segments.routines, entries: list.routines.map((r) => row(r)) });
		}
		return out;
	});

	function pick(r: PickRow) {
		const c = candidates.find((x) => `${x.kind}:${x.id}` === r.key);
		if (c) onpick(c);
	}
</script>

<Picker
	{open}
	{title}
	placeholder={t().routine.picker.search}
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
			<p class="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
				<span class="flex-none text-accent-text"><Icon name="flag" size={15} /></span>{context}
			</p>
		{/if}
		{#if list.toggles.count || list.toggles.hold}
			<div role="group" aria-label={t().routine.picker.filters} class="mt-2 flex gap-2">
				{#if list.toggles.count}
					<label class={CHIP}>
						<input type="checkbox" class="sr-only" bind:checked={count} />
						{#if count}<span class="mr-1 flex"><Icon name="check" size={16} /></span>{/if}{t()
							.routine.picker.count}
					</label>
				{/if}
				{#if list.toggles.hold}
					<label class={CHIP}>
						<input type="checkbox" class="sr-only" bind:checked={hold} />
						{#if hold}<span class="mr-1 flex"><Icon name="check" size={16} /></span>{/if}{t()
							.routine.picker.hold}
					</label>
				{/if}
			</div>
		{/if}
	{/snippet}
	{#snippet empty()}
		{emptyText}
		{#if list.emptiedBy.includes('hold')}
			<button type="button" class={RESCUE} onclick={() => (hold = false)}
				>{t().routine.picker.holdOff}</button
			>{t().routine.picker.toSeeRest}
		{:else if list.emptiedBy.includes('count')}
			<button type="button" class={RESCUE} onclick={() => (count = false)}
				>{t().routine.picker.countOff}</button
			>{t().routine.picker.toSeeRest}
		{/if}
	{/snippet}
</Picker>
