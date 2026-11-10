<script lang="ts">
	/**
	 * The first time a video stays only on an iPhone (offline phase 4c, look 3B):
	 * a warm card under it says iOS may delete it, until the person closes it
	 * (Got it, ×, or Upload). After that, only the ⓘ after its words (`IphoneWhy`).
	 */
	import Icon from './Icon.svelte';
	import { button, iconButton } from './styles';
	import { t } from '$lib/i18n/catalog';
	import { closeIphoneCard } from '$lib/offline/iphone-card.svelte';

	let { onupload }: { onupload: () => void } = $props();
	const w = $derived(t().video.place);
</script>

<div class="rounded-2xl bg-warn-soft px-3.5 py-3" data-iphone-card>
	<div class="flex items-center gap-2 text-[15px] font-extrabold text-warn">
		<Icon name="info" size={18} />
		<span class="flex-1">{w.iphoneTitle}</span>
		<button
			type="button"
			class="{iconButton('bare', 'muted')} -my-2 -mr-2"
			aria-label={w.close}
			onclick={closeIphoneCard}><Icon name="close" size={18} /></button
		>
	</div>
	<p class="mt-1 text-[13px] leading-snug font-medium text-ink-2">{w.iphoneBody}</p>
	<div class="mt-2.5 flex gap-2">
		<button
			type="button"
			class={button('primary', 'sm')}
			onclick={() => {
				closeIphoneCard();
				onupload();
			}}>{w.upload}</button
		>
		<button type="button" class={button('secondary', 'sm')} onclick={closeIphoneCard}
			>{w.gotIt}</button
		>
	</div>
</div>
