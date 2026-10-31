<script lang="ts">
	import { resolve } from '$app/paths';
	import LogShell, { type LogProps } from '../../LogShell.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { button } from '$lib/components/ui/styles';
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
		<div class="flex flex-col gap-3">
			<Content dance={props.dance} content={payload.content} timezone={props.timezone} />
			{#if payload.content.type === 'routine' && !props.backfillDay}
				<a
					href={resolve(
						`/${props.dance.slug}/player?routine=${payload.content.routine.id}&exercise=${props.exercise.id}`
					)}
					class={button('secondary', 'md', true)}
					><Icon name="play" size={20} />Practise in player</a
				>
				<p class="-mt-1 px-1 text-[13px] text-muted">
					A run there saves itself. Log here when you practised away from the app.
				</p>
			{/if}
		</div>
	{/snippet}
</LogShell>
