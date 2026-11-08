<!-- src/lib/components/exercises/PractiseCard.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { PLAY_ROUND } from '$lib/components/ui/styles';
	import { parsePhonePractice, practiseWithLine } from '$lib/exercises/practice';
	import { loadPhonePractice } from '$lib/exercises/phone-practice';
	import { exercisePlayerHref } from '$lib/player/view';
	import { t } from '$lib/i18n/catalog';
	import type { Dance } from '$lib/dances/dances';
	import type { ExerciseItem, PickerSong } from '$lib/types';

	/*
	 * The exercise page's Practise with: what the player will open with, and the
	 * way into it (one-player design). Nothing plays here: the card opens the
	 * player's setup, ▶ opens it playing. The player logs nothing; Done does.
	 */
	interface Props {
		dance: Dance;
		exercise: ExerciseItem;
		songs: PickerSong[];
		/** The player link's `from` part: 'from=exercise', or a run's. */
		from: string;
		/** Either link was tapped: the page is about to be left for the player. */
		onleave?: () => void;
	}

	let { dance, exercise, songs, from, onleave }: Props = $props();

	// This phone's memory is read once mounted: the server has none, and the
	// first render must match it.
	let stored = $state<unknown>({});
	onMount(() => {
		stored = loadPhonePractice(dance.slug);
	});
	const line = $derived(
		practiseWithLine(exercise, songs, parsePhonePractice(stored, dance), dance)
	);
</script>

<section
	aria-label={t().exercise.panel.label}
	class="flex flex-none items-center gap-2.5 rounded-[18px] bg-surface py-3 pr-3 pl-4"
>
	<!-- eslint-disable svelte/no-navigation-without-resolve -- exercisePlayerHref builds both links -->
	<a
		href={exercisePlayerHref(dance.slug, exercise.id, from, false)}
		class="flex min-h-12 min-w-0 flex-1 flex-col justify-center gap-0.5 rounded-lg text-left"
		onclick={onleave}
	>
		<span class="text-[13px] font-bold text-muted">{t().exercise.panel.practiseWith}</span>
		<span class="text-[15px] leading-[1.3] font-bold text-ink">{line}</span>
	</a>
	<a
		href={exercisePlayerHref(dance.slug, exercise.id, from, true)}
		aria-label={t().exercise.panel.play}
		class={PLAY_ROUND}
		onclick={onleave}
	>
		<Icon name="play" size={24} filled />
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
</section>
