<script lang="ts">
	import PracticePanel from '$lib/components/player/PracticePanel.svelte';
	import type { PracticeProps } from '../index';

	let { dance, exercise, content, songs, takes, onrun, onactive }: PracticeProps = $props();
</script>

<PracticePanel
	{dance}
	{exercise}
	{songs}
	{takes}
	cue={content.type === 'figure'
		? { figureId: content.figure.id, say: content.figure.say, eights: content.figure.eights }
		: null}
	{onrun}
	{onactive}
/>
