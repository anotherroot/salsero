<script lang="ts">
	import LogShell, { type LogProps } from '../../LogShell.svelte';
	import PracticePanel from '$lib/components/player/PracticePanel.svelte';
	import Content from './Content.svelte';

	let props: LogProps = $props();
	let run = $state<{ durationS: number; playerJson: string } | null>(null);
	let playing = $state(false);
	/**
	 * Sets logged in this popup. The panel is keyed on it, so after a set is
	 * saved the panel starts fresh — banked time belongs to exactly one set.
	 */
	let logged = $state(0);
</script>

<LogShell
	{...props}
	{run}
	{playing}
	onlogged={(d, s) => {
		logged += 1;
		run = null;
		props.onlogged?.(d, s);
	}}
>
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
	{#snippet panel()}
		{#if !props.backfillDay}
			{#key logged}
				<PracticePanel
					dance={props.dance}
					exercise={props.exercise}
					songs={props.songs}
					takes={props.takes}
					cue={null}
					onrun={(r) => (run = r)}
					onactive={(a) => (playing = a)}
				/>
			{/key}
		{/if}
	{/snippet}
</LogShell>
