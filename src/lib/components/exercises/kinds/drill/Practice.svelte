<script lang="ts">
	import PracticePanel from '$lib/components/player/PracticePanel.svelte';
	import type { PracticeProps } from '../index';

	let { dance, exercise, songs, takes, onrun, onactive }: PracticeProps = $props();
</script>

<PracticePanel {dance} {exercise} {songs} {takes} cue={null} {onrun} {onactive} />
