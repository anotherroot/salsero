<script lang="ts">
	/**
	 * The one picker behind every way of adding: a seam's ↓+ / ↑+, the + at
	 * either end, Add above / below, and + Alternative. One tap inserts and
	 * closes — there is no confirm step.
	 */
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import { FIELD } from '$lib/components/ui/styles';
	import { anchorText, pickList, type Anchor, type Candidate } from '$lib/routines/fit';

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
	let search: HTMLInputElement | undefined = $state();

	// Every opening starts clean: both filters on, no search left over.
	$effect(() => {
		if (!open) return;
		query = '';
		count = true;
		hold = true;
	});

	// Focus the search only with a mouse: on a phone the keyboard would cover
	// the list, which is what the sheet was opened to see.
	$effect(() => {
		if (search && matchMedia('(pointer: fine)').matches) search.focus();
	});

	const list = $derived(pickList(candidates, anchor, { count, hold, query }));
	const context = $derived(anchorText(anchor, positionName));
	const nothing = $derived(list.figures.length === 0 && list.routines.length === 0);

	const emptyText = $derived.by(() => {
		if (anchor.kind === 'alternative') return 'No other figure starts and lands like this one.';
		if (query.trim() !== '' && list.emptiedBy.length === 0) return 'Nothing by that name.';
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

	const chip = (on: boolean) =>
		`h-8 rounded-full border px-3 text-[13px] ${
			on ? 'border-accent bg-accent/10 font-medium text-accent' : 'border-line bg-raised text-muted'
		}`;
	// Two lines per row: the name, then its timing and holds. Start and end
	// hold names together are too long to share a line with the name.
	const row = 'block w-full border-b border-line py-2 text-left text-[15px]';
	const metaClass = 'block truncate text-[12px] text-muted';
	const heading = 'mt-3 mb-1 text-[11px] font-medium tracking-wide text-muted uppercase';
</script>

<Sheet {title} {open} {onclose}>
	{#if context}
		<p class="-mt-2 mb-3 text-[13px] text-ink-2">{context}</p>
	{/if}
	<input
		bind:this={search}
		bind:value={query}
		type="search"
		placeholder="Search figures and routines"
		aria-label="Search figures and routines"
		class={FIELD}
	/>
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
				<button type="button" class={chip(hold)} aria-pressed={hold} onclick={() => (hold = !hold)}
					>{hold ? '✓ ' : ''}Hold</button
				>
			{/if}
		</div>
	{/if}

	<div class="mt-1 max-h-[55dvh] overflow-y-auto">
		{#if nothing}
			<p class="mt-3 rounded-lg bg-plane p-3 text-[13px] text-ink-2">
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
			</p>
		{/if}

		{#if list.figures.length > 0}
			<p class={heading}>Figures</p>
			<ul>
				{#each list.figures as group (group.head.id)}
					<li>
						{#if group.headFits}
							<button type="button" class={row} onclick={() => onpick(group.head)}>
								<span class="block truncate">{group.head.label}</span>
								<span class={metaClass}>{meta(group.head)}</span>
							</button>
						{:else}
							<!-- Greyed: a header so its variations still read as a group. -->
							<div class="{row} text-muted">
								<span class="block truncate">{group.head.label}</span>
								<span class={metaClass}>{meta(group.head)}</span>
							</div>
						{/if}
						{#each group.variations as v (v.id)}
							<button type="button" class="{row} pl-5 text-[14px]" onclick={() => onpick(v)}>
								<span class="block truncate"><span class="text-muted">└ </span>{v.label}</span>
								<span class={metaClass}>{meta(v)}</span>
							</button>
						{/each}
					</li>
				{/each}
			</ul>
		{/if}

		{#if list.routines.length > 0}
			<p class={heading}>Routines</p>
			<ul>
				{#each list.routines as r (r.id)}
					<li>
						<button type="button" class={row} onclick={() => onpick(r)}>
							<span class="block truncate">{r.label}</span>
							<span class={metaClass}>{meta(r)}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</Sheet>
