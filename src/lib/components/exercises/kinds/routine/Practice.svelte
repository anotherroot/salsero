<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { button } from '$lib/components/ui/styles';
	import { t } from '$lib/i18n/catalog';
	import type { PracticeProps } from '../index';

	let { dance, exercise, content, playerFrom }: PracticeProps = $props();
</script>

<!--
	A routine is practised in the full player — calls and slots live there, and
	that run saves itself. Done is for a routine practised away from the app.
-->
{#if content.type === 'routine'}
	<div class="flex flex-col gap-2">
		<a
			href={resolve(
				`/${dance.slug}/player?routine=${content.routine.id}&exercise=${exercise.id}&${playerFrom}`
			)}
			class={button('secondary', 'md', true)}
			><Icon name="play" size={20} />{t().exercise.content.practiseInPlayer}</a
		>
		<p class="px-1 text-[13px] text-muted">{t().exercise.content.routineNote}</p>
	</div>
{/if}
