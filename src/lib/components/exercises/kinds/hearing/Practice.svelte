<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { button, SECTION_LABEL } from '$lib/components/ui/styles';
	import HearingSettingsSheet from '$lib/components/hearing/HearingSettingsSheet.svelte';
	import { roundsLine } from '$lib/hearing/drill';
	import { kindLine } from '$lib/hearing/words';
	import { t } from '$lib/i18n/catalog';
	import type { PracticeProps } from '../index';

	/**
	 * A hearing drill's Practise card (phase 2, board 2): what a round plays,
	 * Spremeni (this round, or the drill's settings for an editor) and ▶ Začni
	 * (its listening page); under it, Vaši krogi: the last score and a line of
	 * the scores on the drill's own settings.
	 */
	let { dance, exercise, content, onleave, canEdit = false }: PracticeProps = $props();
	const hearing = $derived(content.type === 'drill' ? (content.hearing ?? null) : null);
	const w = $derived(t().hearing.drill);
	const playable = $derived(hearing?.songs.filter((s) => s.usable) ?? []);
	const line = $derived(roundsLine(hearing?.rounds ?? []));
	let changing = $state(false);

	/** The scores as a line in a 180 × 48 box, oldest left; one score is a dot. */
	const points = $derived.by(() => {
		const s = line.scores.slice(-12);
		if (s.length === 0) return [];
		const x = (i: number) => (s.length === 1 ? 174 : 6 + (i * 168) / (s.length - 1));
		return s.map((v, i) => ({ x: x(i), y: 44 - (v / 100) * 40 }));
	});
</script>

{#if hearing}
	<section
		aria-label={t().exercise.panel.label}
		class="flex flex-none flex-col gap-3 rounded-[18px] bg-surface p-3"
	>
		<div class="flex items-center gap-3 pl-1">
			<span
				class="flex size-10 flex-none items-center justify-center rounded-full bg-accent-soft text-accent-text"
				><Icon name="ear" size={20} /></span
			>
			<span class="flex min-w-0 flex-1 flex-col gap-0.5">
				<span class="text-[13px] font-bold text-muted">{w.listen}</span>
				<span class="text-[15px] leading-[1.3] font-bold text-ink"
					>{kindLine(hearing.settings)}</span
				>
				<span class="line-clamp-2 text-[13px] text-ink-2"
					>{playable.map((s) => s.title).join(', ')}</span
				>
			</span>
			<button type="button" class={button('secondary', 'sm')} onclick={() => (changing = true)}
				><Icon name="sliders" size={18} />{w.change}</button
			>
		</div>
		{#if playable.length > 0}
			<a
				href={resolve(`/${dance.slug}/hearing/${exercise.id}`)}
				class={button('primary', 'md', true)}
				onclick={onleave}><Icon name="play" size={20} filled />{t().hearing.setup.start}</a
			>
		{:else}
			<p class="m-0 px-1 text-[14px] font-semibold text-danger">
				{t().refusals.noHearingSongs}
			</p>
		{/if}
	</section>

	<div class="flex flex-col gap-1.5">
		<h2 class={SECTION_LABEL}>{w.rounds(line.count)}</h2>
		<div class="flex items-center gap-4 rounded-2xl bg-surface px-4 py-3">
			{#if line.last === null}
				<p class="m-0 text-[14px] text-muted">{w.noRounds}</p>
			{:else}
				<span class="flex flex-none flex-col">
					<span class="font-display text-[28px] leading-none font-extrabold text-ink"
						>{line.last}</span
					>
					<span class="mt-1 text-[12px] text-muted">{w.last}</span>
				</span>
				<svg
					viewBox="0 0 180 48"
					class="h-12 min-w-0 flex-1"
					role="img"
					aria-label={w.scoresLabel(line.scores.join(', '))}
				>
					<line x1="0" y1="47" x2="180" y2="47" class="stroke-track" stroke-width="1" />
					{#if points.length > 1}
						<polyline
							points={points.map((p) => `${p.x},${p.y}`).join(' ')}
							fill="none"
							class="stroke-accent"
							stroke-width="2.2"
							stroke-linejoin="round"
							stroke-linecap="round"
						/>
					{/if}
					{#if points.length}
						<circle
							cx={points[points.length - 1].x}
							cy={points[points.length - 1].y}
							r="3.5"
							class="fill-accent"
						/>
					{/if}
				</svg>
			{/if}
		</div>
	</div>

	{#if changing}
		<HearingSettingsSheet
			{dance}
			exerciseId={exercise.id}
			settings={hearing.settings}
			canSave={canEdit}
			onclose={() => (changing = false)}
			{onleave}
		/>
	{/if}
{/if}
