<script lang="ts">
	import { HOW, howExampleLabel } from '$lib/positions/view';

	/**
	 * How positions work: a small example, then five short sections. HowSheet's
	 * content, and on the desktop the pane beside an empty Positions list.
	 */
</script>

{#snippet pill(name: string, end: boolean)}
	<span
		class="inline-flex h-[34px] flex-none items-center rounded-full px-3.5 text-[14px] font-extrabold {end
			? 'bg-accent text-on-accent'
			: 'bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-hairline)]'}">{name}</span
	>
{/snippet}

<div class="flex flex-col gap-3 pb-1">
	<!-- A position, a figure, the next position: one strip, the second figure leaving the first's end. -->
	<div
		role="img"
		aria-label={howExampleLabel()}
		class="flex flex-wrap items-center gap-2.5 rounded-2xl bg-accent-soft p-4"
	>
		{#each HOW.example as [start, figure, end], i (i)}
			{#if start}{@render pill(start, false)}{/if}
			<span class="inline-flex flex-none flex-col items-center text-[12px] font-bold text-muted"
				>{figure}<span class="text-[18px] leading-none text-accent-text" aria-hidden="true">⟶</span
				></span
			>
			{@render pill(end, true)}
		{/each}
	</div>
	{#each HOW.sections as s (s.title)}
		<section class="flex flex-col gap-1">
			<h3 class="text-[16px] font-extrabold text-ink">{s.title}</h3>
			<p class="text-[15px] leading-normal text-ink-2">{s.body}</p>
		</section>
	{/each}
</div>
