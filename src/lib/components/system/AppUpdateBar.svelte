<script lang="ts">
	import Banner from '$lib/components/ui/Banner.svelte';
	import UpdateButton from './UpdateButton.svelte';
	import type { AppUpdate } from '$lib/app-update/view';

	let { update }: { update: AppUpdate } = $props();
</script>

<Banner kind="info" title="Update available">
	{#snippet action()}<UpdateButton {update} />{/snippet}
</Banner>
