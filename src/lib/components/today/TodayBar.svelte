<script module lang="ts">
	import type { TodayHero as Hero } from '$lib/exercises/today';

	/** What the last card in sight showed (not reactive: only a new card's start). */
	let lastSeen: Hero | null = null;

	const sameHero = (a: Hero, b: Hero) =>
		a.state === b.state &&
		a.title === b.title &&
		a.meta === b.meta &&
		a.bar === b.bar &&
		a.progress === b.progress;
</script>

<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { PRESS } from '$lib/components/ui/styles';
	import type { TodayHero } from '$lib/exercises/today';
	import { untrack } from 'svelte';
	import { fly } from 'svelte/transition';
	import { MS, reducedMotion } from '$lib/motion/motion';
	import { settledIn } from '$lib/motion/page-move.svelte';

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
		onplay,
		shown = true
	}: {
		hero: TodayHero;
		/** "Start". */
		playLabel: string;
		onplay: () => void;
		/** False while it is hidden (the phone, an exercise open over Today). */
		shown?: boolean;
	} = $props();

	/*
	 * What the card draws: the hero as last seen. While hidden it waits; once in
	 * sight it takes the new one a frame later, so the old bar and words paint
	 * first and then move: the bar fills, the words swap (the Done landing, spec
	 * 2026-11-10-motion-round-1). Never shown yet: the hero as it is, still.
	 */
	// Each page draws its own card: a new one starts from what the last one showed.
	let drawn = $state<TodayHero | null>(lastSeen);
	const view = $derived(drawn ?? hero);
	let card = $state<HTMLElement>();
	$effect(() => {
		const next = hero;
		if (!shown) return;
		const now = untrack(() => drawn);
		if (now === null || sameHero(now, next)) {
			drawn = lastSeen = next;
			return;
		}
		// Once the card has landed (page changes spec), then a frame later, so the old state painted first.
		let frame = 0;
		const timer = setTimeout(() => {
			frame = requestAnimationFrame(() => {
				// The old state is on screen now: its style computed first, so the change can transition.
				void card?.offsetWidth;
				drawn = lastSeen = next;
			});
		}, untrack(settledIn));
		return () => {
			clearTimeout(timer);
			cancelAnimationFrame(frame);
		};
	});

	/** The words' swap: the old line lifts away, the new one rises in. */
	const swapMs = () => (reducedMotion() ? 0 : MS.short);

	const cls =
		'flex min-h-[84px] w-full flex-none items-center gap-[14px] rounded-[22px] bg-surface py-[14px] pr-[14px] pl-5 text-left shadow-[0_4px_16px_rgb(0_0_0/0.12)]';
</script>

<div bind:this={card} class={cls} role={hero.state === 'todo' ? undefined : 'status'}>
	<div class="flex min-w-0 flex-1 flex-col gap-[7px]">
		<!-- Read once, as they are now: the lines drawn below swap with an old and a new copy. -->
		<span class="sr-only">{hero.title} · {hero.meta}</span>
		<span
			class="grid font-display text-[25px] leading-[1.1] font-extrabold tracking-[-0.01em] text-ink"
		>
			{#key view.title}<span
					aria-hidden="true"
					class="[grid-area:1/1]"
					in:fly={{ y: 8, duration: swapMs(), delay: swapMs() * 0.6 }}
					out:fly={{ y: -8, duration: swapMs() }}>{view.title}</span
				>{/key}
		</span>
		{#if view.bar}
			<!-- The words under it say the same: the bar is for the eye. -->
			<span class="block h-2 w-full overflow-hidden rounded-full bg-track" aria-hidden="true">
				<span
					class="block h-full rounded-full bg-done transition-[width] delay-120 duration-380 ease-arrive motion-reduce:transition-none"
					style:width="{Math.round(view.progress * 100)}%"
				></span>
			</span>
		{/if}
		<span class="grid text-[14px] font-semibold text-muted">
			{#key view.meta}<span
					aria-hidden="true"
					class="[grid-area:1/1]"
					in:fly={{ y: 8, duration: swapMs(), delay: swapMs() * 0.6 }}
					out:fly={{ y: -8, duration: swapMs() }}>{view.meta}</span
				>{/key}
		</span>
	</div>
	{#if view.state === 'todo'}
		<button
			type="button"
			class="flex h-[54px] w-[54px] flex-none cursor-pointer items-center justify-center rounded-full bg-accent text-on-accent {PRESS}"
			style:--icon-knockout="var(--color-accent)"
			aria-label={playLabel}
			onclick={onplay}
		>
			<span class="ml-[3px] flex"><Icon name="play" size={24} filled /></span>
		</button>
	{:else if view.state === 'nothing'}
		<span
			class="flex h-[54px] w-[54px] flex-none items-center justify-center rounded-full bg-done-soft text-done"
		>
			<Icon name="check" size={28} stroke={2.6} />
		</span>
	{/if}
</div>
