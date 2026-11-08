<script lang="ts">
	import { enhance } from '$app/forms';
	import CardFrame from '$lib/components/shell/CardFrame.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { button } from '$lib/components/ui/styles';
	import { joinQuestion, peopleLine } from '$lib/teams/view';
	import { t } from '$lib/i18n/catalog';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let submitting = $state(false);
</script>

<svelte:head><title>{t().entry.classes.joinTitle(data.name)}</title></svelte:head>

<div data-dance={data.dance} style:display="contents">
	<CardFrame
		title={joinQuestion(data.name)}
		subtitle="{data.danceLabel} · {peopleLine(data.people)}"
	>
		<form
			method="POST"
			action="?/join"
			class="flex flex-col gap-4 rounded-[22px] bg-surface px-4 pt-5 pb-4"
			use:enhance={({ cancel }) => {
				if (submitting) return cancel();
				submitting = true;
				return async ({ update }) => {
					try {
						await update();
					} finally {
						submitting = false;
					}
				};
			}}
		>
			{#if form?.message}<Banner kind="error" title={form.message} />{/if}
			<button type="submit" class={button('primary', 'lg', true)} aria-busy={submitting}>
				{#if submitting}<Spinner size={24} />
					{t().entry.firstRun.join.joining}{:else}{t().entry.firstRun.join.join}{/if}
			</button>
		</form>
	</CardFrame>
</div>
