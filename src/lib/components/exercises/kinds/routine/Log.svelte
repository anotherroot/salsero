<script lang="ts">
	import { resolve } from '$app/paths';
	import LogShell, { type LogProps } from '../../LogShell.svelte';
	import Content from './Content.svelte';

	let props: LogProps = $props();
</script>

<!--
	A routine is practised in the full player — calls and slots live there, and
	that run saves through the player's own save sheet. This form is for a
	routine practised away from the app.
-->
<LogShell {...props} run={null} playing={false}>
	{#snippet body(payload)}
		<Content dance={props.dance} content={payload.content} />
		{#if payload.content.type === 'routine' && !props.backfillDay}
			<a
				href={resolve(
					`/${props.dance.slug}/player?routine=${payload.content.routine.id}&exercise=${props.exercise.id}`
				)}
				class="mt-3 flex h-12 w-full items-center justify-center rounded-xl border border-accent text-[15px] font-semibold text-accent"
				>Practise in player →</a
			>
		{/if}
	{/snippet}
</LogShell>
