<script lang="ts">
	import { resolve } from '$app/paths';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { button } from '$lib/components/ui/styles';
	import { t } from '$lib/i18n/catalog';
	import type { PageData } from './$types';

	/*
	 * Music with no song open. The list, its band and its forms are the layout's
	 * (`ListPane`, `MusicList`); this is what the pane beside the list shows on
	 * the desktop. The phone draws none of it: there the list page is the list.
	 */
	let { data }: { data: PageData } = $props();
	const title = $derived(t().shell.tabs.music);
</script>

<svelte:head><title>{title} · {data.dance.label}</title></svelte:head>

<EmptyState icon="music" title={t().songs.picker.title} body={t().songs.list.paneBody}>
	{#snippet action()}
		<a href={resolve(`/${data.dance.slug}/player?bpm=180`)} class={button('secondary', 'md')}>
			<Icon name="metronome" size={20} />{t().songs.list.paneCountOnly}
		</a>
	{/snippet}
</EmptyState>
