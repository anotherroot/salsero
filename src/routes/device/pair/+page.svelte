<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { isDanceSlug } from '$lib/dances/dances';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BottomBar from '$lib/components/ui/BottomBar.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import StatusBlock from '$lib/components/system/StatusBlock.svelte';
	import { button } from '$lib/components/ui/styles';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let busy = $state(false);

	// The app opened this page for one dance; otherwise the one last used.
	const asked = $derived(page.url.searchParams.get('dance') ?? '');
	const dance = $derived(isDanceSlug(asked) ? asked : data.lastDance);

	// Straight into the app once the token exists; the link below is the
	// fallback if Chrome wants a tap of its own for an app link.
	$effect(() => {
		if (form?.link) window.location.href = form.link;
	});
</script>

<svelte:head><title>Pair the app</title></svelte:head>

<div data-dance={dance} style:display="contents">
	<Screen title="Pair the app">
		{#if form?.link}
			<StatusBlock
				icon="check"
				tone="done"
				title="Paired"
				body="Opening the app now. If it does not open by itself, tap the button."
			/>
			<BottomBar>
				<!-- eslint-disable svelte/no-navigation-without-resolve -- an app link, not a route -->
				<a href={form.link} rel="external" class={button('primary', 'lg', true)}>Open the app</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</BottomBar>
		{:else}
			<StatusBlock
				icon="phone"
				tone="accent"
				title="Pair this phone"
				body="Lets the app upload videos in the background and remind you what is due. You can remove it again in Settings."
			/>
			<BottomBar>
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
						{#if busy}<Spinner size={24} /> Pairing…{:else}Pair this phone{/if}
					</button>
				</form>
			</BottomBar>
		{/if}
	</Screen>
</div>
