<script lang="ts">
	import { resolve } from '$app/paths';
	import LogShell, { type LogProps } from '../../LogShell.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { button } from '$lib/components/ui/styles';
	import { t } from '$lib/i18n/catalog';
	import Content from './Content.svelte';

	let props: LogProps = $props();
</script>

<!--
	A routine is practised in the full player — calls and slots live there, and
	that run saves through the player's own save sheet. This form is for a
	routine practised away from the app.
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
		{#if payload.content.type === 'routine' && !props.backfillDay}
			<a
				href={resolve(
					`/${props.dance.slug}/player?routine=${payload.content.routine.id}&exercise=${props.exercise.id}&from=${props.from ?? 'today'}`
				)}
				class={button('secondary', 'md', true)}
				><Icon name="play" size={20} />{t().exercise.content.practiseInPlayer}</a
			>
			<p class="-mt-1 px-1 text-[13px] text-muted">
				{t().exercise.content.routineNote}
			</p>
		{/if}
	{/snippet}
</LogShell>
