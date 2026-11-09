<script lang="ts">
	import CardFrame from '$lib/components/shell/CardFrame.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import { button } from '$lib/components/ui/styles';
	import { t } from '$lib/i18n/catalog';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const w = $derived(t().settings.connector);
	const title = $derived(data.kind === 'ask' ? w.title(data.host) : w.approve);
</script>

<svelte:head><title>{title}</title></svelte:head>

<div data-dance={data.appDance} style:display="contents">
	<CardFrame {title}>
		<div class="flex flex-col gap-4 rounded-[22px] bg-surface px-4 pt-5 pb-4">
			{#if data.kind === 'ask'}
				<!-- The host first and large: a client can call itself anything. -->
				<p class="font-display text-[22px] leading-tight font-extrabold break-all text-ink">
					{data.host}
				</p>
				{#if data.name}<p class="text-[15px] text-muted">{w.calls(data.name)}</p>{/if}
				<p class="text-ink2 text-[16px] leading-normal">{w.can}</p>
				<!-- A plain form, no enhance: the 303 goes to the AI app, a real navigation. -->
				<form method="POST" class="flex flex-col gap-3">
					{#each Object.entries(data.carried) as [name, value] (name)}
						<input type="hidden" {name} {value} />
					{/each}
					<input type="hidden" name="as" value={data.as} />
					<button formaction="?/approve" class={button('primary', 'lg', true)}>{w.approve}</button>
					<button formaction="?/cancel" class={button('secondary', 'lg', true)}>{w.cancel}</button>
				</form>
			{:else if data.kind === 'otherDance'}
				<Banner kind="info" title={w.otherDance(data.dance)} />
			{:else}
				<Banner kind="error" title={w.badRequest} />
			{/if}
		</div>
	</CardFrame>
</div>
