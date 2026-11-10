<script lang="ts">
	/** The ⓘ after "only on this iPhone" (offline phase 4c, look 3B): the card's words again, in a sheet. */
	import Icon from './Icon.svelte';
	import Sheet from './Sheet.svelte';
	import { t } from '$lib/i18n/catalog';

	const w = $derived(t().video.place);
	let open = $state(false);
</script>

<button
	type="button"
	class="inline-flex size-6 cursor-pointer items-center justify-center align-middle text-warn"
	aria-label={w.iphoneWhy}
	aria-haspopup="dialog"
	onclick={() => (open = true)}><Icon name="info" size={15} /></button
>
<Sheet title={w.iphoneTitle} size="small" {open} onclose={() => (open = false)}>
	<p class="px-1 text-[15px] text-ink-2">{w.iphoneBody}</p>
</Sheet>
