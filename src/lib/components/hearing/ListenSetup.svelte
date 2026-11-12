<script lang="ts">
	import { CLAVE_PATTERNS, type ClavePattern } from '$lib/labels';
	import { CHIP, GROUP, ROW, SECTION_LABEL } from '$lib/components/ui/styles';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { t } from '$lib/i18n/catalog';
	import { ownCounts, type TargetId } from '$lib/hearing/targets';
	import { targetLabel } from '$lib/hearing/words';
	import ClaveCard from './ClaveCard.svelte';
	import type { RoundKind } from '$lib/hearing/round';

	/** The round's choices, in the sheet under the stage. Start is the page's bar. */
	interface Props {
		kind: RoundKind;
		target: TargetId;
		clave: ClavePattern;
		/** The counts for the `own` target. */
		own: number[];
		/** The chosen part of the song (an index into `parts`), or null for the whole song. */
		part: number | null;
		targets: TargetId[];
		parts: string[];
		tapDelayMs: number | null;
		oncheck: () => void;
		/** Hear the clave: two eights of the count with the clave on (the page's, inside the tap). */
		onhearclave: () => void;
		/** The tap delay row: off in a hearing drill's settings (phase 2), where the round checks it. */
		check?: boolean;
	}

	let {
		kind = $bindable(),
		target = $bindable(),
		clave = $bindable(),
		own = $bindable(),
		part = $bindable(),
		targets,
		parts,
		tapDelayMs,
		oncheck,
		onhearclave,
		check = true
	}: Props = $props();
	const w = $derived(t().hearing);
	const KINDS: RoundKind[] = ['tapAlong', 'dropped'];
</script>

<div class="flex flex-col gap-1.5">
	<h2 class={SECTION_LABEL}>{w.setup.kind}</h2>
	<div role="radiogroup" aria-label={w.setup.kind} class="flex flex-wrap gap-x-2 gap-y-1">
		{#each KINDS as k (k)}
			<label class={CHIP}>
				<input
					type="radio"
					name="kind"
					value={k}
					class="sr-only"
					checked={kind === k}
					onchange={() => (kind = k)}
				/>
				{w.kinds[k]}
			</label>
		{/each}
	</div>
</div>

<div class="flex flex-col gap-1.5">
	<h2 class={SECTION_LABEL}>{w.setup.target}</h2>
	<div role="radiogroup" aria-label={w.setup.target} class="flex flex-wrap gap-x-2 gap-y-1">
		{#each targets as id (id)}
			<label class={CHIP}>
				<input
					type="radio"
					name="target"
					value={id}
					class="sr-only"
					checked={target === id}
					onchange={() => (target = id)}
				/>
				{id === 'own' ? w.targets.own : targetLabel(id)}
			</label>
		{/each}
	</div>
	{#if target === 'clave'}
		<div role="radiogroup" aria-label={w.targets.clave} class="flex flex-wrap gap-x-2 gap-y-1">
			{#each CLAVE_PATTERNS as c (c)}
				<label class={CHIP}>
					<input
						type="radio"
						name="clave"
						value={c}
						class="sr-only"
						checked={clave === c}
						onchange={() => (clave = c)}
					/>
					{c}
				</label>
			{/each}
		</div>
		<ClaveCard {clave} onhear={onhearclave} />
	{/if}
	{#if target === 'own'}
		<!-- In a form (a hearing drill's settings) the counts post as one field. -->
		<input type="hidden" name="positions" value={own.join(',')} />
		<div role="group" aria-label={w.setup.ownCounts} class="flex flex-wrap gap-x-1.5 gap-y-1">
			{#each [1, 2, 3, 4, 5, 6, 7, 8] as c (c)}
				<label class={CHIP}>
					<input
						type="checkbox"
						class="sr-only"
						checked={own.includes(c)}
						onchange={(e) =>
							(own = e.currentTarget.checked ? ownCounts([...own, c]) : own.filter((x) => x !== c))}
					/>
					{c}
				</label>
			{/each}
		</div>
	{/if}
</div>

{#if kind === 'tapAlong' && parts.length > 0}
	<div class="flex flex-col gap-1.5">
		<h2 class={SECTION_LABEL}>{w.setup.part}</h2>
		<div role="radiogroup" aria-label={w.setup.part} class="flex flex-wrap gap-x-2 gap-y-1">
			<label class={CHIP}>
				<input
					type="radio"
					name="part"
					class="sr-only"
					checked={part === null}
					onchange={() => (part = null)}
				/>
				{w.setup.wholeSong}
			</label>
			{#each parts as name, i (i)}
				<label class={CHIP}>
					<input
						type="radio"
						name="part"
						class="sr-only"
						checked={part === i}
						onchange={() => (part = i)}
					/>
					{name}
				</label>
			{/each}
		</div>
	</div>
{/if}

{#if check}
	<div class={GROUP}>
		<button
			type="button"
			class="{ROW} focus-inset w-full cursor-pointer text-left active:bg-step"
			onclick={oncheck}
		>
			<span class="flex-1 text-[16px] font-bold text-ink">{w.check.row}</span>
			<span class="text-[15px] text-muted tabular-nums">{w.check.rowValue(tapDelayMs)}</span>
			<span class="text-chevron"><Icon name="chevron-right" size={20} /></span>
		</button>
	</div>
{/if}
