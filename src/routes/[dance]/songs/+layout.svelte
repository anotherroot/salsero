<script lang="ts">
	import { page } from '$app/state';
	import { listOf } from '$lib/nav/pane';
	import ListPane from '$lib/components/shell/ListPane.svelte';
	import MusicList from '$lib/components/songs/MusicList.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import GroupModeButton from '$lib/components/shell/GroupModeButton.svelte';
	import { groupModeShown, levelShown } from '$lib/levels/levels';

	/*
	 * Music: the list and the song beside it (desktop spec, "A list and the item
	 * beside it"). The list renders here once, so opening a song keeps its scroll
	 * and search; the list page is the pane with nothing open, a song page the
	 * song. On the phone the list page looks as it always has and a song page is
	 * the song alone.
	 */
	let { data, children } = $props();

	const l = $derived(listOf(page.route.id));
	const isList = $derived(l?.open === false);
	// The Add a song sheet: the band's + and the list's own buttons open it.
	let adding = $state(false);
</script>

{#snippet right()}
	{#if groupModeShown(levelShown(page.data.user?.level))}<GroupModeButton />{/if}
	<BandButton icon="plus" label="Add a song" onclick={() => (adding = true)} />
{/snippet}

{#snippet list()}
	<MusicList {data} {isList} bind:adding />
{/snippet}

{#if l}
	<ListPane title="Music" {isList} {list} {right} empty={children}>
		{@render children()}
	</ListPane>
{:else}
	{@render children()}
{/if}
