<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { isDanceSlug } from '$lib/dances/dances';
	import CardFrame from '$lib/components/shell/CardFrame.svelte';
	import BottomBar from '$lib/components/ui/BottomBar.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import StatusBlock from '$lib/components/system/StatusBlock.svelte';
	import { button } from '$lib/components/ui/styles';
	import { t } from '$lib/i18n/catalog';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let busy = $state(false);
	const w = $derived(t().settings.pair);

	// The app opened this page for one dance; otherwise the account's.
	const asked = $derived(page.url.searchParams.get('dance') ?? '');
	const dance = $derived(isDanceSlug(asked) ? asked : data.appDance);

	// Straight into the app once the token exists; the link below is the
	// fallback if Chrome wants a tap of its own for an app link.
	$effect(() => {
		if (form?.link) window.location.href = form.link;
	});
</script>

<svelte:head><title>{w.title}</title></svelte:head>

<div data-dance={dance} style:display="contents">
	<CardFrame title={w.title}>
		{#if form?.link}
			<StatusBlock
				icon="check"
				tone="done"
				title={w.paired}
				body={w.pairedBody}
				class="desk:pt-3"
			/>
			<BottomBar card>
				<a href={form.link} rel="external" class={button('primary', 'lg', true)}>{w.openApp}</a>
			</BottomBar>
		{:else}
			<StatusBlock icon="phone" tone="accent" title={w.pairPhone} body={w.body} class="desk:pt-3" />
			<BottomBar card>
				<form
					method="POST"
					use:enhance={({ cancel }) => {
						if (busy) return cancel();
						busy = true;
						return async ({ update }) => {
							await update();
							busy = false;
						};
					}}
				>
					<button class={button('primary', 'lg', true)} aria-busy={busy}>
						{#if busy}<Spinner size={24} /> {w.pairing}{:else}{w.pairPhone}{/if}
					</button>
				</form>
			</BottomBar>
		{/if}
	</CardFrame>
</div>
