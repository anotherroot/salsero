<script lang="ts">
	import LogShell, { type LogProps } from '../../LogShell.svelte';
	import Practice from './Practice.svelte';
	import Content from './Content.svelte';

	let props: LogProps = $props();
</script>

<!--
	A routine is practised in the full player — calls and slots live there, and
	that run saves itself. This form is for a routine practised away from the app.
-->
<LogShell {...props} run={null} playing={false}>
	{#snippet reference(payload)}
		<Content
			dance={props.dance}
			content={payload.content}
			timezone={props.timezone}
			canEdit={props.exercise.team === null}
			simple={props.simple}
			{...props.contentProps}
		/>
	{/snippet}
	{#snippet panel(payload)}
		{#if !props.backfillDay}
			<Practice
				dance={props.dance}
				exercise={props.exercise}
				content={payload.content}
				songs={props.songs}
				takes={props.takes}
				playerFrom="from={props.from ?? 'today'}"
				onrun={() => {}}
				onactive={() => {}}
			/>
		{/if}
	{/snippet}
</LogShell>
