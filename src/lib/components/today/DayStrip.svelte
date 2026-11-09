<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { t } from '$lib/i18n/catalog';

	/*
	 * A past day's way through the days, under its title: ‹ the day (opens the
	 * calendar) ›, and Today beside it. The slim band keeps ‹ › and Today only.
	 */
	let {
		prevHref,
		nextHref,
		todayHref,
		label,
		onpick
	}: {
		prevHref: string;
		nextHref: string;
		todayHref: string;
		/** The day said relatively: "3 days ago", "Yesterday". */
		label: string;
		onpick: () => void;
	} = $props();

	const STEP =
		'grid size-10 flex-none place-items-center rounded-full active:bg-band-ink/15 focus-visible:outline-2 focus-visible:outline-band-ink';
</script>

<div class="flex items-center gap-2 pt-1">
	<div
		class="flex h-11 min-w-0 flex-1 items-center justify-between gap-1 rounded-full bg-band-track px-0.5 text-band-small"
	>
		<a href={prevHref} aria-label={t().today.list.previousDay} class={STEP}
			><Icon name="chevron-left" /></a
		>
		<button
			type="button"
			class="flex h-10 min-w-0 cursor-pointer items-center gap-1.5 rounded-full px-2 text-[15px] font-extrabold active:bg-band-ink/15"
			aria-haspopup="dialog"
			data-focus="day-strip-pick"
			onclick={onpick}
		>
			<Icon name="calendar" size={18} />
			<span class="truncate">{label}</span>
			<span class="sr-only">· {t().today.past.pickDay}</span>
			<Icon name="chevron-down" size={16} />
		</button>
		<a href={nextHref} aria-label={t().today.list.nextDay} class={STEP}
			><Icon name="chevron-right" /></a
		>
	</div>
	<a
		href={todayHref}
		aria-label={t().today.list.backToToday}
		class="inline-flex h-11 flex-none items-center rounded-full bg-band-ink px-4 text-[15px] font-extrabold text-band active:opacity-80"
		>{t().shell.tabs.today}</a
	>
</div>
