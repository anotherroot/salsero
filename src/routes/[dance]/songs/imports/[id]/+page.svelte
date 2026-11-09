<script lang="ts">
	import { withView } from '$lib/teams/group-view';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BackButton from '$lib/components/shell/BackButton.svelte';
	import PickList from '$lib/components/songs/PickList.svelte';
	import { sourceLine } from '$lib/songs/imports';
	import { t } from '$lib/i18n/catalog';
	// The page's group view (`?in=`, or its row's): links to the lists keep it.
	const viewTeam = $derived(page.data.groupMode?.teamId ?? null);

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
				href: withView(resolve('/[dance]/songs', { dance: data.dance.slug }), viewTeam),
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
