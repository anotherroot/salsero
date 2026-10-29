<script lang="ts">
	import LogShell, { type LogProps } from '../../LogShell.svelte';
	import PracticePanel from '$lib/components/player/PracticePanel.svelte';
	import Content from './Content.svelte';

	let props: LogProps = $props();
	let run = $state<{ durationS: number; playerJson: string } | null>(null);
	let playing = $state(false);
	/** See drill/Log.svelte: the panel starts fresh after each saved set. */
	let logged = $state(0);
	/** The reference folds away so the panel is one tap from the top on a phone. */
	let showReference = $state(true);
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
		<button
			type="button"
			class="mb-2 text-[13px] text-accent"
			aria-expanded={showReference}
			onclick={() => (showReference = !showReference)}
			>{showReference ? 'Hide reference' : 'Show reference'}</button
		>
		{#if showReference}
			<Content dance={props.dance} content={payload.content} />
		{/if}
		{#if !props.backfillDay}
			<div class="mt-3">
				{#key logged}
					<PracticePanel
						dance={props.dance}
						exercise={props.exercise}
						songs={props.songs}
						takes={props.takes}
						cue={payload.content.type === 'figure'
							? {
									figureId: payload.content.figure.id,
									say: payload.content.figure.say,
									eights: payload.content.figure.eights
								}
							: null}
						onrun={(r) => (run = r)}
						onactive={(a) => (playing = a)}
					/>
				{/key}
			</div>
		{/if}
	{/snippet}
</LogShell>
