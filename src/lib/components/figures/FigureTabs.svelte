<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { DanceSlug } from '$lib/dances/dances';
	import { t } from '$lib/i18n/catalog';
	import type { SiblingSummary } from '$lib/types';

	/**
	 * The move's figures as tabs under a figure's pane header (desktop spec, "Two
	 * columns", the pane header of a figure): a pill per figure, the open one solid
	 * accent; "+ Figure" (an editor's: New figure, a copy of the open one, in
	 * `VariationBar`'s one sheet, through `onnew`); "Open {move} ›" to the move's
	 * page. Desktop only: the phone keeps its switcher at the bottom. Each pill is a
	 * link that replaces the history entry, as the switcher's steps do: the figure
	 * is one page in the trail.
	 */
	let {
		moveName,
		moveId,
		siblings,
		currentId,
		slug,
		canEdit,
		onnew
	}: {
		moveName: string;
		moveId: number;
		/** The move's figures as the Figures list merges them (groups' same-named moves too), the open one included. */
		siblings: SiblingSummary[];
		currentId: number;
		slug: DanceSlug;
		canEdit: boolean;
		onnew: () => void;
	} = $props();

	const href = (id: number) =>
		resolve('/[dance]/(moves)/figures/[id]', { dance: slug, id: String(id) });
	const moveHref = $derived(
		resolve('/[dance]/(moves)/moves/[id]', { dance: slug, id: String(moveId) })
	);
	const PILL = 'flex h-9 items-center rounded-[18px] px-4 text-[14px] leading-none';
</script>

<nav
	aria-label={t().figure.switcher.tabs(moveName)}
	class="hidden flex-wrap items-center gap-2 desk:-mt-2.5 desk:mb-3.5 desk:flex"
>
	{#each siblings as s (s.id)}
		{@const here = s.id === currentId}
		<a
			href={href(s.id)}
			data-sveltekit-replacestate
			aria-current={here ? 'page' : undefined}
			title={s.team?.name}
			class="{PILL} gap-1.5 {here
				? 'bg-accent font-extrabold text-on-accent'
				: 'bg-chip font-bold text-chip-ink'}"
			><!-- A group's figure: the group's people icon, its name in the title and for a screen reader. -->{#if s.team}<Icon
					name="people"
					size={16}
				/><span class="sr-only">{s.team.name}:</span>{/if}{s.name}</a
		>
	{/each}
	{#if canEdit}
		<button
			type="button"
			aria-haspopup="dialog"
			aria-label={t().moves.move.newFigure}
			onclick={onnew}
			class="{PILL} cursor-pointer gap-1.5 border-[1.5px] border-dashed border-accent-text font-bold text-accent-text"
			><Icon name="plus" size={18} />{t().figure.switcher.tab}</button
		>
	{/if}
	<a
		href={moveHref}
		class="ml-auto flex min-h-9 items-center gap-0.5 text-[14px] font-extrabold text-accent-text"
		>{t().figure.switcher.open(moveName)}<Icon name="chevron-right" size={16} /></a
	>
</nav>
