<script lang="ts">
	import { onMount } from 'svelte';
	import PractiseCard from '$lib/components/exercises/PractiseCard.svelte';
	import { loadRoutineView } from '$lib/exercises/phone-practice';
	import type { PracticeProps } from '../index';

	let { dance, exercise, content, songs, playerFrom, onleave }: PracticeProps = $props();

	// Follow or Still is this phone's, per routine: read once mounted, as the card reads its memory.
	let view = $state<'follow' | 'still' | null>(null);
	onMount(() => {
		if (content.type === 'routine') view = loadRoutineView(dance.slug, content.routine.id);
	});
</script>

<PractiseCard
	{dance}
	{exercise}
	{songs}
	{view}
	routineId={content.type === 'routine' ? content.routine.id : null}
	from={playerFrom}
	{onleave}
/>
