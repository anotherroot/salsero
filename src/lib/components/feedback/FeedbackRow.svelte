<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import LeadTile from '$lib/components/system/LeadTile.svelte';
	import { GROUP, ROW_TALL, PRESS_ROW } from '$lib/components/ui/styles';
	import FeedbackSheet from './FeedbackSheet.svelte';
	import { t } from '$lib/i18n/catalog';

	/** Send feedback: the row on You and Settings, opening the sheet (`FeedbackSheet`). */
	const w = $derived(t().feedback);
	let open = $state(false);
</script>

<div class={GROUP}>
	<button
		type="button"
		class="{ROW_TALL} w-full text-left {PRESS_ROW}"
		onclick={() => (open = true)}
	>
		<LeadTile icon="flag" />
		<span class="flex min-w-0 flex-1 flex-col">
			<span class="text-[16px] font-bold text-ink">{w.row}</span>
			<span class="text-[13px] text-muted">{w.rowSub}</span>
		</span>
		<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
	</button>
</div>

<FeedbackSheet {open} onclose={() => (open = false)} />
