<script lang="ts">
	import Switch from '$lib/components/ui/Switch.svelte';
	import { t } from '$lib/i18n/catalog';

	/**
	 * The Warm-up switch, the Active row's twin. A form that has it also sends
	 * `warmupSent`: an unchecked switch posts nothing, and without the marker the
	 * server would keep the old value.
	 */
	let { checked = $bindable(false), daily }: { checked?: boolean; daily: number } = $props();
</script>

<div class="flex min-h-[52px] items-center gap-3">
	<input type="hidden" name="warmupSent" value="1" />
	<span class="flex min-w-0 flex-1 flex-col gap-px">
		<span class="text-[16px] font-bold text-ink">{t().exercise.warmup.title}</span>
		<span class="text-[13px] text-muted">{t().exercise.warmup.note(daily)}</span>
	</span>
	<Switch name="warmup" label={t().exercise.warmup.title} bind:checked />
</div>
