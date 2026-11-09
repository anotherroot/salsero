<!-- src/lib/components/exercises/PractiseCard.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { button } from '$lib/components/ui/styles';
	import { parsePhonePractice, practiseWithLine } from '$lib/exercises/practice';
	import { loadPhonePractice } from '$lib/exercises/phone-practice';
	import { exercisePlayerHref } from '$lib/player/view';
	import { t } from '$lib/i18n/catalog';
	import type { Dance } from '$lib/dances/dances';
	import type { ExerciseItem, PickerSong } from '$lib/types';

	/*
	 * The exercise page's Practise card, the same on every type (practise-card
	 * design): what the player will open with, Change (the player's Setup,
	 * nothing plays) and ▶ Practise (the player, playing). Both are said in
	 * words. Nothing plays here; the player logs nothing, Done does.
	 */
	interface Props {
		dance: Dance;
		exercise: ExerciseItem;
		songs: PickerSong[];
		/** The player link's `from` part: 'from=exercise', or a run's. */
		from: string;
		/** A routine's Follow or Still on this phone, said after the song; null for the others. */
		view?: 'follow' | 'still' | null;
		/** A routine's exercise: the routine it runs on in the player. */
		routineId?: number | null;
		/** Either link was tapped: the page is about to be left for the player. */
		onleave?: () => void;
	}

	let { dance, exercise, songs, from, view = null, routineId = null, onleave }: Props = $props();

	// This phone's memory is read once mounted: the server has none, and the
	// first render must match it.
	let stored = $state<unknown>({});
	onMount(() => {
		stored = loadPhonePractice(dance.slug);
	});
	const line = $derived(
		practiseWithLine(
			exercise,
			songs,
			parsePhonePractice(stored, dance),
			dance,
			view === null ? null : t().player[view]
		)
	);
</script>

<section
	aria-label={t().exercise.panel.label}
	class="flex flex-none flex-col gap-3 rounded-[18px] bg-surface p-3"
>
	<div class="flex items-center gap-3 pl-1">
		<span
			class="flex size-10 flex-none items-center justify-center rounded-full bg-accent-soft text-accent-text"
			><Icon name="music" size={20} /></span
		>
		<span class="flex min-w-0 flex-1 flex-col gap-0.5">
			<span class="text-[13px] font-bold text-muted">{t().exercise.panel.practiseWith}</span>
			<span class="line-clamp-2 text-[15px] leading-[1.3] font-bold text-ink">{line}</span>
		</span>
		<a
			href={exercisePlayerHref(dance.slug, exercise.id, from, false, routineId)}
			class={button('secondary', 'sm')}
			onclick={onleave}><Icon name="sliders" size={18} />{t().exercise.panel.change}</a
		>
	</div>
	<a
		href={exercisePlayerHref(dance.slug, exercise.id, from, true, routineId)}
		class={button('primary', 'md', true)}
		onclick={onleave}><Icon name="play" size={20} filled />{t().exercise.panel.practise}</a
	>
</section>
