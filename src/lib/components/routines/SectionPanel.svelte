<script lang="ts">
	/**
	 * A section or routine opened in place (spec 2026-11-12, routine sections,
	 * G2 + H1): its slots follow its card inside a rounded panel whose solid,
	 * light colour depends on the level and repeats every four; a routine inside
	 * is grey. A child of its own opens the same way, 3 px further in, up to
	 * level 4; deeper ones open on their own page.
	 */
	import Icon from '$lib/components/ui/Icon.svelte';
	import { t } from '$lib/i18n/catalog';
	import { openable, panelHue } from '$lib/routines/panels';
	import type { ChildView } from '$lib/types';
	import SectionPanel from './SectionPanel.svelte';

	interface Props {
		view: ChildView;
		/** 1 for a child of the routine's own slots. */
		depth: number;
		children: Record<number, ChildView>;
		/** Open slots, by step id, at every level. */
		opened: number[];
		ontoggle: (stepId: number) => void;
		/** The names above this panel, for the "where am I" bar. */
		path: { name: string; hue: string }[];
	}
	let { view, depth, children, opened, ontoggle, path }: Props = $props();

	const name = (v: ChildView) => v.name || t().routine.section.unnamed;
	const here = $derived([...path, { name: name(view), hue: panelHue(depth, !view.isSection) }]);
	let lifted = $state<number | null>(null);
</script>

<div class="flex flex-col gap-2" role="group" aria-label={name(view)}>
	{#each view.rows as row, i (row.id)}
		{@const child = row.childId === null ? undefined : children[row.childId]}
		{@const open = child !== undefined && opened.includes(row.id) && openable(depth + 1)}
		{@const card = `flex min-h-[56px] items-center gap-2.5 rounded-2xl bg-surface py-2 pr-2 pl-3`}
		<div
			class={open ? `panel hue-${panelHue(depth + 1, !child!.isSection)}` : 'contents'}
			data-path={JSON.stringify(here)}
		>
			<div
				class="{card} {lifted === row.id ? 'lifted' : ''}"
				role="button"
				tabindex="0"
				onclick={() => (lifted = lifted === row.id ? null : row.id)}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') lifted = lifted === row.id ? null : row.id;
				}}
			>
				<span
					class="grid size-[26px] shrink-0 place-items-center rounded-full bg-accent-soft text-[11.5px] font-extrabold text-accent-text"
					>{i + 1}</span
				>
				<span class="min-w-0 flex-1">
					<span class="block truncate text-[15px] leading-[1.3] font-semibold text-ink">
						{#if child}<span class="mr-1.5 inline-block align-[-3px] text-accent-text"
								><Icon name={child.isSection ? 'brace' : 'route'} size={17} /></span
							>{/if}{#if child && !child.name}<span class="text-muted italic"
								>{t().routine.section.unnamed}</span
							>{:else}{row.title}{/if}
					</span>
					{#if row.meta}<span class="block truncate text-[12.5px] text-muted">{row.meta}</span>{/if}
					{#if child}<span class="block truncate text-[12.5px] text-muted"
							>{t().nouns.figures(child.figures)} · {t().nouns.eights(child.eights)}</span
						>{/if}
				</span>
				{#if child && openable(depth + 1)}
					<button
						type="button"
						class="grid size-11 shrink-0 cursor-pointer place-items-center"
						aria-expanded={open}
						aria-label={open
							? t().routine.section.close(child.name)
							: t().routine.section.open(child.name)}
						onclick={(e) => {
							e.stopPropagation();
							ontoggle(row.id);
						}}
						><span
							class="grid size-[30px] place-items-center rounded-full bg-accent-soft text-accent-text"
							><Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} /></span
						></button
					>
				{:else if child && row.href}
					<a
						href={row.href}
						class="grid size-11 shrink-0 place-items-center text-accent-text"
						aria-label={t().routine.section.deeper(depth + 1)}
						title={t().routine.section.deeper(depth + 1)}
						onclick={(e) => e.stopPropagation()}><Icon name="arrow-up-right" size={18} /></a
					>
				{/if}
			</div>
			{#if lifted === row.id}
				<!-- T1 (spec 2026-11-12): where it lives, and Open. -->
				<div
					class="-mt-1 flex items-center gap-2 rounded-b-2xl bg-surface px-3 pb-2 text-[12.5px] text-ink-2"
				>
					<span class="min-w-0 flex-1 truncate"
						>{t().routine.section.inside(name(view), view.holders)}</span
					>
					{#if row.href}<a
							href={row.href}
							class="flex h-9 items-center gap-1 font-extrabold text-accent-text"
							><Icon name="arrow-up-right" size={16} />{t().routine.slot.openCell}</a
						>{/if}
				</div>
			{/if}
			{#if child && !openable(depth + 1)}
				<p class="-mt-1 px-2 text-[12px] font-semibold text-accent-text">
					{t().routine.section.deeper(depth + 1)}
				</p>
			{/if}
			{#if open && child}
				<SectionPanel view={child} depth={depth + 1} {children} {opened} {ontoggle} path={here} />
			{/if}
		</div>
	{/each}
</div>

<style>
	.lifted {
		box-shadow:
			0 14px 34px rgb(0 0 0 / 0.18),
			0 0 0 1px color-mix(in srgb, var(--color-accent) 22%, transparent);
		position: relative;
		z-index: 1;
	}
</style>
