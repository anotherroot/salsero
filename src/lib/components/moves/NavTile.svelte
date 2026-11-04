<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { IconName } from '$lib/icons/icons';

	/**
	 * A link card: a tonal icon disc, a title, one meta line. Coverage sits
	 * at the top of the Figures list; cards placed in one row share it.
	 * `status` makes the meta a status word (what still needs doing).
	 */
	let {
		href,
		icon,
		title,
		meta,
		status = false
	}: { href: string; icon: IconName; title: string; meta: string; status?: boolean } = $props();
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- the caller passes a resolved href -->
<a
	{href}
	class="flex min-h-16 min-w-0 flex-1 items-center gap-2.5 rounded-2xl bg-surface p-3 text-ink active:bg-step"
>
	<span
		class="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-accent-soft text-accent-text"
	>
		<Icon name={icon} size={22} />
	</span>
	<span class="flex min-w-0 flex-1 flex-col gap-px">
		<span class="text-[16px] leading-[1.3] font-bold">{title}</span>
		<span
			class="truncate text-[13px] leading-[1.3] whitespace-nowrap {status
				? 'font-bold text-status'
				: 'font-medium text-muted'}">{meta}</span
		>
	</span>
</a>
<!-- eslint-enable svelte/no-navigation-without-resolve -->
