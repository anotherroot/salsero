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
	onlogged={(d) => {
		logged += 1;
		run = null;
		props.onlogged?.(d);
	}}
>
	{#snippet body(payload)}
		<Content dance={props.dance} content={payload.content} />
		{#if !props.backfillDay}
			<div class="mt-3">
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
			</div>
		{/if}
	{/snippet}
</LogShell>
