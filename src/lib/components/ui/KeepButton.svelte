<script lang="ts">
	/**
	 * The phone button under a video (offline phase 4b, look 3·1): one tap keeps
	 * this video on the phone, another takes it off; while it comes, a ring
	 * shows how far. A video its switched-on space keeps shows it lit and opens
	 * On this phone, since the switch is what keeps it. Nothing where the
	 * phone has no store, or for anything but a lesson video or a recording.
	 */
	import Icon from './Icon.svelte';
	import { iconButton } from './styles';
	import { t } from '$lib/i18n/catalog';
	import { mediaOf } from '$lib/offline/media-store';
	import { changeKeep, kept } from '$lib/offline/kept.svelte';
	import { videoKeep } from '$lib/offline/kept-view';

	let { src }: { src: string } = $props();

	const k = $derived(videoKeep(kept.status, src));
	const key = $derived.by(() => {
		const m = mediaOf(src);
		return m ? `${m.kind}/${m.file}` : '';
	});
	const w = $derived(t().settings.onPhone);
	const label = $derived(
		!k || k.state === 'space'
			? ''
			: k.state === 'off'
				? w.keep
				: k.state === 'on'
					? w.remove
					: w.stop(k.state === 'coming' ? k.percent : 0)
	);
</script>

{#if k?.state === 'space'}
	<a
		href="/settings/phone"
		class={iconButton('bare', 'done')}
		aria-label={w.bySpace(k.name ?? w.myLessons)}
		data-keep="space"><Icon name="phone-check" size={22} /></a
	>
{:else if k}
	<button
		type="button"
		class={iconButton('bare', k.state === 'on' ? 'done' : k.state === 'waiting' ? 'muted' : 'ink')}
		aria-label={label}
		aria-pressed={k.state !== 'off'}
		data-keep={k.state}
		onclick={() => void changeKeep({ video: key, on: k.state === 'off' })}
	>
		{#if k.state === 'coming'}
			<span class="keep-ring size-[22px] rounded-full" style:--p="{k.percent}%" aria-hidden="true"
			></span>
		{:else}
			<Icon name={k.state === 'on' ? 'phone-check' : 'phone-down'} size={22} />
		{/if}
	</button>
{/if}

<style>
	.keep-ring {
		background: conic-gradient(var(--color-accent) var(--p), var(--color-track) 0);
		mask: radial-gradient(circle, transparent 7px, #000 7.5px);
	}
</style>
