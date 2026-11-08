<script lang="ts">
	import { resolve } from '$app/paths';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BackButton from '$lib/components/shell/BackButton.svelte';
	import PickList from '$lib/components/songs/PickList.svelte';
	import { sourceLine } from '$lib/songs/imports';
	import { t } from '$lib/i18n/catalog';

	let { data, form } = $props();
	const name = $derived(data.imp.name ?? t().songs.imports.kinds[data.imp.kind]);
</script>

<Screen
	compact
	width="song"
	title={name}
	subtitle={sourceLine(data.imp.kind, data.items.length, data.imp.truncated)}
>
	{#snippet left()}
		<BackButton
			fallback={{
				href: resolve('/[dance]/songs', { dance: data.dance.slug }),
				label: t().songs.imports.toPick
			}}
		/>
	{/snippet}
	{#key data.imp.id}
		<PickList
			items={data.items}
			kind={data.imp.kind}
			truncated={data.imp.truncated}
			dance={data.dance}
			refusal={form?.message ?? null}
		/>
	{/key}
</Screen>
