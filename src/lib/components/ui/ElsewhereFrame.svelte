<script lang="ts">
	/**
	 * A phone-only video seen from another device (offline phase 4c, look 2A):
	 * a dark frame the video's size where its picture would be, saying which
	 * device holds it. Its sections still list below; it cannot play here.
	 */
	import Icon from './Icon.svelte';
	import { CLIP } from './styles';
	import { t } from '$lib/i18n/catalog';
	import type { DeviceLabel } from '$lib/devices/label';

	let { label }: { label: DeviceLabel | null } = $props();
	const w = $derived(t().video.place);
</script>

<div
	class="{CLIP} relative flex aspect-video w-full flex-col items-center justify-center gap-1 bg-black/85 px-8 text-center text-white desk:max-h-[70dvh]"
	data-elsewhere
>
	<span class="mb-1 flex text-white/70"><Icon name="phone" size={30} /></span>
	<span class="text-[17px] font-extrabold">{w.frameTitle(label)}</span>
	<span class="text-[13px] leading-snug text-white/70">{w.frameBody}</span>
</div>
