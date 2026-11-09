<script lang="ts">
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import { button } from '$lib/components/ui/styles';
	import { dayLabel, monthLabel } from '$lib/format';
	import { t } from '$lib/i18n/catalog';
	import type { CalendarDay, CalendarMonth } from '$lib/types';

	/*
	 * Pick any day: the months one under another (oldest on top), each day a tile
	 * with how many exercises it had. The shown day is filled, today outlined, the
	 * days after today are not buttons. A pick goes there (`onpick`).
	 */
	let {
		open,
		onclose,
		months,
		today,
		onpick
	}: {
		open: boolean;
		onclose: () => void;
		months: CalendarMonth[];
		today: string;
		/** A day was picked: the page closes the sheet and goes to it. */
		onpick: (day: string) => void;
	} = $props();

	let body = $state<HTMLElement>();

	// Opened: the shown day in view (the months above it are older).
	$effect(() => {
		if (!open || !body) return;
		const el = body;
		requestAnimationFrame(() =>
			el.querySelector('[aria-current="date"]')?.scrollIntoView({ block: 'center' })
		);
	});

	/** Monday first: the catalog's short weekdays start on Sunday. */
	const letters = $derived(
		[1, 2, 3, 4, 5, 6, 0].map((i) => t().format.weekdaysShort[i].charAt(0).toUpperCase())
	);

	function tile(d: CalendarDay): string {
		const base =
			'flex h-[50px] flex-col items-center justify-center rounded-xl text-[15px] font-bold tabular-nums';
		if (d.when === 'future') return `${base} text-muted opacity-50`;
		const look = d.shown
			? 'bg-accent text-on-accent'
			: d.count > 0
				? 'bg-accent-soft text-ink'
				: 'bg-surface text-ink';
		const ring =
			d.when === 'today' && !d.shown ? ' shadow-[inset_0_0_0_2px_var(--color-accent-text)]' : '';
		return `${base} ${look}${ring} cursor-pointer active:brightness-95`;
	}
</script>

<Sheet title={t().today.past.pickDay} {open} {onclose} tall>
	<div bind:this={body} class="flex flex-col gap-6 pb-2">
		{#each months as m (m.first)}
			<section aria-label={monthLabel(m.first)}>
				<h3 class="flex items-baseline justify-between gap-3 px-0.5 pb-2">
					<span class="font-display text-[22px] leading-tight font-extrabold text-ink"
						>{monthLabel(m.first)}</span
					>
					{#if m.activeDays > 0}<span class="text-[13px] font-bold text-muted"
							>{t().today.past.monthTotals(m.activeDays, m.exercises)}</span
						>{/if}
				</h3>
				<div class="grid grid-cols-7 gap-1">
					{#each letters as letter, i (i)}
						<span aria-hidden="true" class="pb-1 text-center text-[12px] font-extrabold text-muted"
							>{letter}</span
						>
					{/each}
					{#each { length: m.lead }, i (i)}<span aria-hidden="true"></span>{/each}
					{#each m.days as d (d.day)}
						{#if d.when === 'future'}
							<span aria-hidden="true" class={tile(d)}>{d.date}<span class="h-[13px]"></span></span>
						{:else}
							<button
								type="button"
								class={tile(d)}
								aria-label={t().today.past.dayCount(dayLabel(d.day), d.count)}
								aria-current={d.shown ? 'date' : undefined}
								onclick={() => onpick(d.day)}
							>
								{d.date}
								<span
									class="h-[13px] text-[11px] leading-[13px] font-extrabold {d.shown
										? 'text-on-accent'
										: 'text-accent-text'}">{d.count > 0 ? d.count : ''}</span
								>
							</button>
						{/if}
					{/each}
				</div>
			</section>
		{/each}
	</div>

	{#snippet footer()}
		<div class="flex items-center gap-3">
			<span class="min-w-0 flex-1 text-[13px] font-bold text-muted">{t().today.past.legend}</span>
			<button type="button" class={button('secondary')} onclick={() => onpick(today)}
				>{t().shell.tabs.today}</button
			>
		</div>
	{/snippet}
</Sheet>
