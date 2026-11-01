<script lang="ts">
	import LogShell, { type LogProps } from '../../LogShell.svelte';
	import PracticePanel from '$lib/components/player/PracticePanel.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { SECTION_HEAD } from '../prose';
	import Content from './Content.svelte';

	let props: LogProps = $props();
	let run = $state<{ durationS: number; playerJson: string } | null>(null);
	let playing = $state(false);
	/** See drill/Log.svelte: the panel starts fresh after each saved set. */
	let logged = $state(0);
	/** The reference folds away so the panel is one tap from the top on a phone. */
	let showReference = $state(true);
	const contentId = $derived(`reference-${props.exercise.id}`);
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
		<div class="flex flex-col gap-3">
			<div class="flex items-center justify-between pr-1">
				<h3 class={SECTION_HEAD}>Reference</h3>
				<button
					type="button"
					class="-my-1.5 flex h-11 cursor-pointer items-center gap-1 px-2.5 text-[14px] font-extrabold text-accent-text"
					aria-expanded={showReference}
					aria-controls={contentId}
					onclick={() => (showReference = !showReference)}
				>
					{showReference ? 'Hide' : 'Show'}<Icon
						name={showReference ? 'chevron-up' : 'chevron-down'}
						size={18}
					/>
				</button>
			</div>
			<div id={contentId} class="contents">
				{#if showReference}
					<Content dance={props.dance} content={payload.content} timezone={props.timezone} />
				{/if}
			</div>
			{#if !props.backfillDay}
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
			{/if}
		</div>
	{/snippet}
</LogShell>
