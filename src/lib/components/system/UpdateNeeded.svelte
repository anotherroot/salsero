<script lang="ts">
	import UpdateButton from './UpdateButton.svelte';
	import type { AppUpdate } from '$lib/app-update/view';

	let { update }: { update: AppUpdate } = $props();
</script>

<svelte:head><title>Update needed</title></svelte:head>

<main class="mx-auto flex min-h-dvh max-w-[560px] flex-col justify-center gap-4 px-6 py-10">
	<h1 class="font-display text-[28px] leading-tight font-extrabold text-ink">Update needed</h1>
	<p class="text-[16px] text-ink-2">
		This version of the app no longer works. Update to keep going.
	</p>
	<UpdateButton {update} />
</main>
