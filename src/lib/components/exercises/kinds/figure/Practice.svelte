<script lang="ts">
	import PractiseCard from '$lib/components/exercises/PractiseCard.svelte';
	import type { PracticeProps } from '../index';

	let { dance, exercise, songs, playerFrom, onleave }: PracticeProps = $props();
</script>

<PractiseCard {dance} {exercise} {songs} from={playerFrom} {onleave} />
