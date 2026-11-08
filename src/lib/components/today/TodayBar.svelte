<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { TodayHero } from '$lib/exercises/today';

	/**
	 * The bar card over Today's list (board "Today"): "3 left for today", a bar
	 * in the done colour on the field line, "2 of 5 done", and play, which starts
	 * the run: the day's exercises, one page after another. Done: a full bar and
	 * no play. Nothing left: a tick in place of the bar and the play. The words
	 * are `todayHero`'s.
	 */
	let {
		hero,
		playLabel,
		onplay
	}: {
		hero: TodayHero;
		/** "Start". */
		playLabel: string;
		onplay: () => void;
	} = $props();

	const cls =
		'flex min-h-[84px] w-full flex-none items-center gap-[14px] rounded-[22px] bg-surface py-[14px] pr-[14px] pl-5 text-left shadow-[0_4px_16px_rgb(0_0_0/0.12)]';
</script>

<div class={cls} role={hero.state === 'todo' ? undefined : 'status'}>
	<div class="flex min-w-0 flex-1 flex-col gap-[7px]">
		<span class="font-display text-[25px] leading-[1.1] font-extrabold tracking-[-0.01em] text-ink"
			>{hero.title}</span
		>
		{#if hero.bar}
			<!-- The words under it say the same: the bar is for the eye. -->
			<span class="block h-2 w-full overflow-hidden rounded-full bg-track" aria-hidden="true">
				<span
					class="block h-full rounded-full bg-done transition-[width] motion-reduce:transition-none"
					style:width="{Math.round(hero.progress * 100)}%"
				></span>
			</span>
		{/if}
		<span class="text-[14px] font-semibold text-muted">{hero.meta}</span>
	</div>
	{#if hero.state === 'todo'}
		<button
			type="button"
			class="flex h-[54px] w-[54px] flex-none cursor-pointer items-center justify-center rounded-full bg-accent text-on-accent"
			style:--icon-knockout="var(--color-accent)"
			aria-label={playLabel}
			onclick={onplay}
		>
			<span class="ml-[3px] flex"><Icon name="play" size={24} filled /></span>
		</button>
	{:else if hero.state === 'nothing'}
		<span
			class="flex h-[54px] w-[54px] flex-none items-center justify-center rounded-full bg-done-soft text-done"
		>
			<Icon name="check" size={28} stroke={2.6} />
		</span>
	{/if}
</div>
