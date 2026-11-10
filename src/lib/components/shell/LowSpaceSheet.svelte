<script lang="ts">
	/**
	 * The phone short of space (offline phase 4b, look 4B): the first time, a
	 * sheet with the suggestions opens once; then only You's dot and the On
	 * this phone page say so, until there is space again (`low-space.ts`).
	 */
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import LowSpaceCard from '$lib/components/settings/LowSpaceCard.svelte';
	import { button } from '$lib/components/ui/styles';
	import { byteSize } from '$lib/format';
	import { t } from '$lib/i18n/catalog';
	import { kept } from '$lib/offline/kept.svelte';
	import { lowShown, setLowShown, shouldOpenLowSheet } from '$lib/offline/low-space';
	import { suggestions } from '$lib/offline/kept-view';

	const w = $derived(t().settings.onPhone.low);
	const status = $derived(kept.status);
	let open = $state(false);

	$effect(() => {
		const low = status?.low ?? false;
		// Space came back: the next shortage opens the sheet once more. No status (not ready): leave it.
		if (status && !low) setLowShown(false);
		if (status && shouldOpenLowSheet(low, lowShown(), suggestions(status).length)) {
			setLowShown(true);
			open = true;
		}
	});
</script>

{#if status}
	<Sheet
		title={w.sheetTitle}
		sub={status.free === null ? undefined : w.sheetBody(byteSize(status.free))}
		{open}
		onclose={() => (open = false)}
	>
		<div class="flex flex-col gap-4 pb-2" data-low-space-sheet>
			<LowSpaceCard {status} warning={false} />
			<button type="button" class={button('secondary', 'lg', true)} onclick={() => (open = false)}
				>{w.later}</button
			>
		</div>
	</Sheet>
{/if}
