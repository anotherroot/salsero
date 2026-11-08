<script lang="ts">
	import UpdateButton from './UpdateButton.svelte';
	import type { AppUpdate } from '$lib/app-update/view';
	import { t } from '$lib/i18n/catalog';

	let { update }: { update: AppUpdate } = $props();
</script>

<svelte:head><title>{t().shell.update.neededTitle}</title></svelte:head>

<main class="mx-auto flex min-h-dvh max-w-[560px] flex-col justify-center gap-4 px-6 py-10">
	<h1 class="font-display text-[28px] leading-tight font-extrabold text-ink">
		{t().shell.update.neededTitle}
	</h1>
	<p class="text-[16px] text-ink-2">{t().shell.update.neededBody}</p>
	<UpdateButton {update} />
</main>
