<script lang="ts">
	import { resolve } from '$app/paths';
	import type { DayRow } from '$lib/schedule/today-list';
	import type { ExerciseItem } from '$lib/types';
	import type { DanceSlug } from '$lib/dances/dances';
	import { rowMeta, tileTone } from '$lib/exercises/today';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Swipeable from '$lib/components/routines/Swipeable.svelte';
	import { desk } from '$lib/nav/desk.svelte';
	import type { Side } from '$lib/gestures/swipe';
	import TypeTile from '$lib/components/ui/TypeTile.svelte';
	import { t } from '$lib/i18n/catalog';

	interface Props {
		row: DayRow<ExerciseItem>;
		dance: DanceSlug;
		/** Today, for the due words. */
		today: string;
		/** A lesson's class day as shown ("Tue 3 Nov"); null for every other type. */
		lessonDay: string | null;
		/** The session's next row: tinted, with an "Up next" badge and an accent tile. */
		upNext: boolean;
		/** The exercise open beside the list (desktop): tinted, an accent bar at its left edge. */
		current: boolean;
		/** Appended to the row's link (a session's flag, on the desktop). */
		search: string;
		/** Not today (the swipe's button); absent on a done row. */
		onskip?: () => void;
		/** This row's swipe: open (left) or at rest. */
		swiped: Side;
		onswipe: (open: Side) => void;
		/** A warm-up row in the card whose rows can be dragged: where the drag has put it. */
		drag?: { offset: number; lifted: boolean; moving: boolean };
	}

	let {
		row,
		dance,
		today,
		lessonDay,
		upNext,
		current,
		search,
		onskip,
		swiped,
		onswipe,
		drag
	}: Props = $props();

	const ex = $derived(row.exercise);
	const done = $derived(row.kind === 'done');
	const meta = $derived(rowMeta(row, today, lessonDay));
	const TONE = { status: 'font-bold text-status', done: 'font-bold text-done' } as const;
	// The Up next tint, or the open row's: both take the tinted tile and the darker meta.
	const tinted = $derived(upNext || current);
	const href = $derived(
		resolve('/[dance]/(today)/exercises/[id]', { dance, id: String(ex.id) }) + search
	);
	const lit = $derived(current ? ('page' as const) : undefined);
	// `data-focus`: Next focuses the first row it adds (`NextRow`).
	const LINK = 'flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-1';
</script>

<!--
	A draggable row is a flat list of its card's rows (`data-warm-row`); the drag moves it with
	the `translate` property, so nothing else about its layout changes.
-->
<li
	data-warm-row={drag ? ex.id : undefined}
	class="{drag?.lifted ? 'relative z-10 shadow-[0_8px_24px_rgb(0_0_0/0.22)]' : ''} {drag?.moving &&
	!drag.lifted
		? 'transition-transform duration-150 motion-reduce:transition-none'
		: ''}"
	style={drag ? `translate: 0 ${drag.offset}px` : undefined}
>
	<!--
		The phone swipes a to-do or picked row left for "Not today" (a done row has
		none; the desktop has Not today on the exercise page). The sliding card carries the
		row's own background, so the warn underlay shows only as it moves.
	-->
	<Swipeable
		key="today:{ex.id}"
		open={swiped}
		onchange={onswipe}
		end={onskip ? { label: t().today.row.notToday, icon: 'redo', onclick: onskip } : undefined}
		disabled={!onskip || desk.current}
		rounded="rounded-none"
		tone="warn"
		reveal={96}
	>
		<div
			class="flex min-h-[66px] items-center px-4 {tinted ? 'bg-accent-soft' : 'bg-surface'} {current
				? 'shadow-[inset_4px_0_0_var(--color-accent)]'
				: ''}"
		>
			<!-- The row opens the exercise: its page is where it is practised and saved. -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved above; search is the query -->
			<a {href} aria-current={lit} data-focus="today-row-{ex.id}" class={LINK}>
				<TypeTile exercise={ex} tone={tileTone(row.kind)} onTint={tinted} />
				<span class="flex min-w-0 flex-1 flex-col gap-0.5">
					<!-- A done row's name is quieter (board "Today"); muted is under 4.5:1 on a tint. -->
					<span
						class="text-[16px] leading-[1.3] font-bold break-words {done && !tinted
							? 'text-muted'
							: 'text-ink'}"
						>{ex.name}{#if upNext}<span class="ml-1 inline-block align-[2px]"
								><Badge tone="accent" solid>{t().today.row.upNext}</Badge></span
							>{/if}</span
					>
					<!-- muted is under 4.5:1 on the Up next tint; ink-2 clears it in every theme. -->
					<span class="text-[13px] leading-[1.35] {tinted ? 'text-ink-2' : 'text-muted'}">
						{#each meta as part, i (i)}{i > 0 ? ' · ' : ''}<span
								class={part.tone ? TONE[part.tone] : ''}>{part.text}</span
							>{/each}
					</span>
				</span>
				<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
			</a>
		</div>
	</Swipeable>
</li>
