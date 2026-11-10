<script lang="ts">
	/**
	 * Where a person's own video is (offline phase 4c, look 1B): one button in
	 * the place of 4b's KeepButton, its icon saying where (a phone: only here; a
	 * ring: uploading; a green cloud: on the server too). It opens Where is this
	 * video (`WhereSheet`): Upload, or Remove the server copy.
	 */
	import Icon from './Icon.svelte';
	import Toast from './Toast.svelte';
	import WhereSheet from './WhereSheet.svelte';
	import { iconButton } from './styles';
	import { t } from '$lib/i18n/catalog';
	import type { Place } from '$lib/offline/where';
	import type { PhoneVideo } from '$lib/offline/places.svelte';

	let { place, video }: { place: Place; video: PhoneVideo } = $props();

	let open = $state(false);
	let toast = $state<{ id: number; message: string; icon?: 'check'; tone?: 'done' } | null>(null);
	let seq = 0;
	const say = (message: string, done = false) =>
		(toast = done ? { id: ++seq, message, icon: 'check', tone: 'done' } : { id: ++seq, message });
</script>

<button
	type="button"
	class={iconButton(
		'bare',
		place.state === 'both' ? 'done' : place.state === 'missing' ? 'danger' : 'ink'
	)}
	aria-label={t().video.place.sheetTitle}
	aria-haspopup="dialog"
	data-where={place.state}
	onclick={() => (open = true)}
>
	{#if place.state === 'uploading'}
		<span class="where-ring size-[22px] rounded-full" style:--p="{place.pct}%" aria-hidden="true"
		></span>
	{:else}
		<Icon name={place.state === 'both' ? 'cloud-check' : 'phone'} size={22} />
	{/if}
</button>

<WhereSheet {open} onclose={() => (open = false)} {place} {video} onsay={say} />
<Toast {toast} ondismiss={() => (toast = null)} />

<style>
	.where-ring {
		background: conic-gradient(var(--color-accent) var(--p), var(--color-track) 0);
		mask: radial-gradient(circle, transparent 7px, #000 7.5px);
	}
</style>
