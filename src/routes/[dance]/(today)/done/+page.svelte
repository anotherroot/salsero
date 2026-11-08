<script lang="ts">
	import { actAt } from '$lib/act';
	import { refusalMessage } from '$lib/act-toast';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import BottomBar from '$lib/components/ui/BottomBar.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import TypeTile from '$lib/components/ui/TypeTile.svelte';
	import Face from '$lib/components/exercises/Face.svelte';
	import { GROUP, rowButton } from '$lib/components/ui/styles';
	import { todayPane } from '$lib/components/today/today-context';
	import { doneForToday } from '$lib/exercises/done-today';
	import { practisedLabel } from '$lib/exercises/exercise-page';
	import { runHref } from '$lib/exercises/run';
	import { longDayLabel } from '$lib/format';
	import { t } from '$lib/i18n/catalog';
	import { todayBack } from '$lib/nav/today-pane';
	import { goBack } from '$lib/nav/trail.svelte';
	import { gotoWhenSettled } from '$lib/sheets/history.svelte';

	/*
	 * Done for today: where a run ends (its last save, or its last Skip, lands
	 * here with a replace). The day summed up from the layout's rows and sets;
	 * Next N picks more and walks them, Back to Today (and the phone's ×) goes
	 * back. On the desktop it is the pane beside Today's list. Nothing on it is
	 * a checkbox.
	 */
	let { data } = $props();

	const dance = $derived(data.dance.slug);
	const view = $derived(doneForToday(data.list.day, data.list.todaySets, data.streak));
	const daily = $derived(data.list.daily);
	// "7 / exercises", "30 min / practised".
	const tiles = $derived([
		{ value: String(view.count), label: t().today.doneToday.exercises(view.count) },
		{ value: practisedLabel(view.seconds), label: t().today.doneToday.practised }
	]);
	const pane = todayPane();

	/** A drill's tile: the Warm-up row wears it. */
	const DRILL = { source: 'custom', partner: null } as const;

	const back = () => void goBack(todayBack(dance));

	let busy = $state(false);

	/** Next N: picks the next in line, then walks them as a run. */
	async function next() {
		if (busy) return;
		busy = true;
		const result = await actAt(`/${dance}`, 'next', {});
		const message = refusalMessage(result, t().today.refused.addMore);
		const first =
			result.type === 'success'
				? (result.data as { exerciseIds?: number[] } | undefined)?.exerciseIds?.[0]
				: undefined;
		if (message || first === undefined) {
			pane?.say(message ?? t().today.refused.addMore);
			busy = false;
			return;
		}
		// Busy until the page leaves: a second tap would pick the next N again.
		gotoWhenSettled(runHref(dance, first, { skip: [] }), { replaceState: true }).catch(
			() => (busy = false)
		);
	}
</script>

<svelte:head><title>{t().today.doneToday.title} · {data.dance.label}</title></svelte:head>

<Screen title={t().today.doneToday.title} subtitle={longDayLabel(data.list.today)}>
	{#snippet right()}
		<!-- The phone's way out; the desktop has Today's list beside it. -->
		<span class="contents desk:hidden"
			><BandButton
				icon="close"
				label={t().shell.backTo(t().shell.tabs.today)}
				onclick={back}
			/></span
		>
	{/snippet}

	<div class="flex flex-col gap-3.5 pb-28">
		<div class="flex rounded-2xl bg-surface">
			{#each tiles as tile, i (i)}
				{#if i > 0}<span aria-hidden="true" class="my-3 w-px flex-none bg-hairline"></span>{/if}
				<div class="flex min-w-0 flex-1 flex-col gap-0.5 px-4 py-3">
					<span class="font-display text-[28px] leading-[1.05] font-extrabold text-ink"
						>{tile.value}</span
					>
					<span class="text-[13px] font-bold text-muted">{tile.label}</span>
				</div>
			{/each}
		</div>

		{#if view.warmup || view.rows.length > 0}
			<ul class={GROUP}>
				{#if view.warmup}
					<li class="flex min-h-[66px] items-center gap-3 px-4 py-2.5">
						<TypeTile exercise={DRILL} tone="accent" />
						<span class="flex min-w-0 flex-1 flex-col gap-0.5">
							<span class="text-[16px] leading-[1.3] font-bold break-words text-ink"
								>{t().exercise.warmup.title}</span
							>
							<span class="text-[13px] leading-[1.35] text-muted">{view.warmup.line}</span>
						</span>
					</li>
				{/if}
				{#each view.rows as row (row.id)}
					<li class="flex min-h-[66px] items-center gap-3 px-4 py-2.5">
						<TypeTile exercise={row} tone="accent" />
						<span class="flex min-w-0 flex-1 flex-col gap-0.5">
							<span class="text-[16px] leading-[1.3] font-bold break-words text-ink"
								>{row.name}</span
							>
							<span class="text-[13px] leading-[1.35] text-muted">{row.back}</span>
						</span>
						{#if row.face}<Face feel={row.face} size={30} label />{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</Screen>

<BottomBar>
	<div class="flex gap-2.5">
		{#if data.more}
			<button
				type="button"
				class={rowButton('secondary')}
				aria-busy={busy}
				disabled={busy}
				onclick={next}
			>
				{#if busy}<Spinner /><span class="sr-only">{t().today.list.next(daily)}</span
					>{:else}{t().today.list.next(daily)}{/if}
			</button>
		{/if}
		<button type="button" class={rowButton('primary')} onclick={back}
			>{t().shell.backTo(t().shell.tabs.today)}</button
		>
	</div>
</BottomBar>
