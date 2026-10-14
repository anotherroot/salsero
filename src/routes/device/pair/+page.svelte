<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let busy = $state(false);

	// Straight into the app once the token exists; the link below is the
	// fallback if Chrome wants a tap of its own for an app link.
	$effect(() => {
		if (form?.link) window.location.href = form.link;
	});
</script>

<svelte:head><title>Pair the app · Salsa</title></svelte:head>

<main class="grid h-dvh place-items-center overflow-y-auto px-5 py-12">
	<div class="w-full max-w-sm space-y-4">
		<div>
			<h1 class="text-[17px] font-semibold tracking-tight">Pair the app</h1>
			<p class="mt-1 text-[13px] text-muted">
				Lets the app upload videos in the background and remind you what is due. You can remove it
				again in Settings.
			</p>
		</div>
		{#if form?.link}
			<!-- eslint-disable svelte/no-navigation-without-resolve -- an app link, not a route -->
			<a
				href={form.link}
				class="flex h-11 w-full items-center justify-center rounded-lg bg-accent text-[15px] font-medium text-white"
			>
				Open the app
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{:else}
			<form
				method="POST"
				use:enhance={() => {
					busy = true;
					return async ({ update }) => {
						await update();
						busy = false;
					};
				}}
			>
				<button
					disabled={busy}
					class="h-11 w-full rounded-lg bg-accent text-[15px] font-medium text-white disabled:opacity-60"
				>
					Pair this phone
				</button>
			</form>
		{/if}
	</div>
</main>
