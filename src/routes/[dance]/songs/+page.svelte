<script lang="ts">
	import { resolve } from '$app/paths';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { button } from '$lib/components/ui/styles';
	import type { PageData } from './$types';

	/*
	 * Music with no song open. The list, its band and its forms are the layout's
	 * (`ListPane`, `MusicList`); this is what the pane beside the list shows on
	 * the desktop. The phone draws none of it: there the list page is the list.
	 */
	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Music · {data.dance.label}</title></svelte:head>

<EmptyState
	icon="music"
	title="Pick a song"
	body="Its count, the 1s you tapped and its sample open here, beside the list."
>
	{#snippet action()}
		<a href={resolve(`/${data.dance.slug}/player?bpm=180`)} class={button('secondary', 'md')}>
			<Icon name="metronome" size={20} />Practice with the count only
		</a>
	{/snippet}
</EmptyState>
