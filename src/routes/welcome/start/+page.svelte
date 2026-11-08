<script lang="ts">
	import { enhance } from '$app/forms';
	import CardFrame from '$lib/components/shell/CardFrame.svelte';
	import ClassCodeField from '$lib/components/teams/ClassCodeField.svelte';
	import LevelCards from '$lib/components/levels/LevelCards.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { button } from '$lib/components/ui/styles';
	import { swipe } from '$lib/gestures/swipe';
	import { t } from '$lib/i18n/catalog';
	import { joinStep, levelStep, slides } from '$lib/levels/first-run';
	import type { Level } from '$lib/levels/levels';
	import { joinQuestion, peopleLine } from '$lib/teams/view';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/*
	 * The first run: slides and How much app? are page state; the join step is
	 * `?step=join` (the level is saved by then). Skip jumps to the level step.
	 */
	let step = $state<'slides' | 'level'>('slides');
	let slide = $state(0);
	let picked = $state<Level | null>(null);
	let busy = $state(false);

	const w = $derived(t().entry.firstRun);
	const slideList = $derived(slides());
	const joinWords = $derived(joinStep());
	const howMuch = $derived(levelStep());
	const last = $derived(slide === slideList.length - 1);
	const joinAction = $derived(`/welcome/start?/join&next=${encodeURIComponent(data.next)}`);

	function go(to: number) {
		slide = Math.min(slideList.length - 1, Math.max(0, to));
	}

	// A swipe on the slide: left is forward, right is back.
	const gesture = swipe({
		reveal: 60,
		lockPx: 8,
		snap: 0.5,
		sides: () => ({ left: true, right: true })
	});
	let dragX = $state(0);
	function down(e: PointerEvent) {
		gesture.down(e.clientX, e.clientY, null);
	}
	function move(e: PointerEvent) {
		const x = gesture.move(e.clientX, e.clientY);
		if (x !== null) dragX = x / 3;
	}
	function up() {
		dragX = 0;
		const side = gesture.up();
		if (side === 'left') go(slide + 1);
		else if (side === 'right') go(slide - 1);
	}
</script>

<svelte:head><title>{t().entry.welcome.title}</title></svelte:head>

<div data-dance={data.dance} style:display="contents">
	{#if data.step === 'join'}
		{#if data.invite}
			<CardFrame
				title={joinQuestion(data.invite.name)}
				subtitle="{data.invite.danceLabel} · {peopleLine(data.invite.people)}"
			>
				<form
					method="POST"
					action="?/join"
					class="flex flex-col gap-3 rounded-[22px] bg-surface px-4 pt-5 pb-4"
					use:enhance={({ cancel }) => {
						if (busy) return cancel();
						busy = true;
						return async ({ update }) => {
							try {
								await update();
							} finally {
								busy = false;
							}
						};
					}}
				>
					<input type="hidden" name="next" value={data.next} />
					<input type="hidden" name="teamCode" value={data.invite.code} />
					{#if form?.message}<Banner kind="error" title={form.message} />{/if}
					<button type="submit" class={button('primary', 'lg', true)} aria-busy={busy}>
						{#if busy}<Spinner size={24} /> {joinWords.joining}{:else}{joinWords.join}{/if}
					</button>
				</form>
				<form method="POST" action="?/skip" use:enhance>
					<input type="hidden" name="next" value={data.next} />
					<button type="submit" class={button('tertiary', 'md', true)}>{joinWords.notNow}</button>
				</form>
			</CardFrame>
		{:else}
			<CardFrame title={joinWords.title} subtitle={joinWords.subtitle} note={joinWords.or}>
				<div class="rounded-[22px] bg-surface px-4 pt-5 pb-4">
					<ClassCodeField action={joinAction} error={form?.message} />
				</div>
				<form method="POST" action="?/skip" use:enhance>
					<input type="hidden" name="next" value={data.next} />
					<button type="submit" class={button('tertiary', 'md', true)}>{joinWords.notNow}</button>
				</form>
			</CardFrame>
		{/if}
	{:else if step === 'slides'}
		<CardFrame title={slideList[slide].title}>
			<div class="flex justify-end">
				<button type="button" class={button('tertiary', 'sm')} onclick={() => (step = 'level')}>
					{w.skip}
				</button>
			</div>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="flex touch-pan-y flex-col gap-5 rounded-[22px] bg-surface px-5 py-6 select-none"
				style:transform="translateX({dragX}px)"
				onpointerdown={down}
				onpointermove={move}
				onpointerup={up}
				onpointercancel={up}
			>
				<p class="min-h-[4.5em] text-[17px] leading-[1.5] text-ink-2" aria-live="polite">
					{slideList[slide].body}
				</p>
				<div class="flex justify-center gap-2" aria-hidden="true">
					{#each slideList as s (s.title)}
						<span class="size-2 rounded-full {s === slideList[slide] ? 'bg-accent' : 'bg-hairline'}"
						></span>
					{/each}
				</div>
			</div>
			<button
				type="button"
				class={button('primary', 'lg', true)}
				onclick={() => (last ? (step = 'level') : go(slide + 1))}
			>
				{w.next}
			</button>
		</CardFrame>
	{:else}
		<CardFrame title={howMuch.title} note={howMuch.note}>
			<form
				method="POST"
				action="?/level"
				class="flex flex-col gap-4"
				use:enhance={({ cancel }) => {
					if (busy || !picked) return cancel();
					busy = true;
					return async ({ update }) => {
						try {
							await update();
						} finally {
							busy = false;
						}
					};
				}}
			>
				<input type="hidden" name="next" value={data.next} />
				<input type="hidden" name="level" value={picked ?? ''} />
				{#if form?.message}<Banner kind="error" title={form.message} />{/if}
				<LevelCards value={picked} onpick={(l) => (picked = l)} />
				<button
					type="submit"
					class={button('primary', 'lg', true)}
					disabled={!picked}
					aria-busy={busy}
				>
					{#if busy}<Spinner size={24} /> {t().entry.welcome.saving}{:else}{t().entry.welcome
							.continue}{/if}
				</button>
			</form>
		</CardFrame>
	{/if}
</div>
