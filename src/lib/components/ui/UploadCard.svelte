<script lang="ts">
	import type { IconName } from '$lib/icons/icons';
	import Icon from './Icon.svelte';
	import { t } from '$lib/i18n/catalog';

	/** An upload on its way: percent, a bar, and the reassurance that the app stays usable. */
	interface Props {
		/** 0–100. */
		pct: number;
		/** What is going up, for the bar's accessible name. */
		label: string;
		/** The heading; default "Uploading… {pct}%". */
		title?: string;
		/** The line under it; default reassures that the app stays usable. */
		helper?: string;
		/** `warn` for a connection that dropped. */
		tone?: 'accent' | 'warn';
		icon?: IconName;
	}

	let { pct, label, title, helper, tone = 'accent', icon = 'upload' }: Props = $props();
	const shown = $derived(Math.floor(pct));
</script>

<div role="status" class="flex flex-col gap-3 rounded-2xl bg-surface p-4">
	<div class="flex items-center gap-3">
		<span
			class="flex h-10 w-10 flex-none items-center justify-center rounded-full {tone === 'warn'
				? 'bg-warn-soft text-warn'
				: 'bg-accent-soft text-accent-text'}"><Icon name={icon} size={22} /></span
		>
		<div class="flex min-w-0 flex-1 flex-col gap-0.5">
			<span class="text-[16px] font-bold">{title ?? t().shell.upload.title(shown)}</span>
			<span class="text-[13px] text-muted">{helper ?? t().shell.upload.helper}</span>
		</div>
	</div>
	<div
		role="progressbar"
		aria-label={t().shell.upload.bar(label)}
		aria-valuemin="0"
		aria-valuemax="100"
		aria-valuenow={shown}
		class="h-1.5 overflow-hidden rounded-[3px] bg-hairline"
	>
		<div
			class="h-full rounded-[3px] transition-[width] {tone === 'warn' ? 'bg-warn' : 'bg-accent'}"
			style="width: {pct}%"
		></div>
	</div>
</div>
