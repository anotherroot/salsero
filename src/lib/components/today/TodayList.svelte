<script lang="ts">
	import { resolve } from '$app/paths';
	import ExerciseRow from '$lib/components/today/ExerciseRow.svelte';
	import NextRow from '$lib/components/today/NextRow.svelte';
	import NothingLeft from '$lib/components/today/NothingLeft.svelte';
	import AppUpdateBar from '$lib/components/system/AppUpdateBar.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { button, GROUP, SECTION_LABEL } from '$lib/components/ui/styles';
	import type { DayList } from '$lib/schedule/today-list';
	import { listLabels } from '$lib/exercises/today';
	import { classDayLabel } from '$lib/format';
	import type { AppUpdate } from '$lib/app-update/view';
	import type { DanceSlug } from '$lib/dances/dances';
	import type { ExerciseItem } from '$lib/types';
	import type { Side } from '$lib/gestures/swipe';
	import { autoScroll, dropIndex, moved, shiftFor } from '$lib/gestures/drag';
	import { dragEdges } from '$lib/gestures/edges';
	import { longPress } from '$lib/longpress';
	import { actAt } from '$lib/act';
	import { refusalMessage } from '$lib/act-toast';

	/**
	 * Today's list: one "Today · N" card (done, to do, picked: `dayList`'s order),
	 * "+ Next 5" as its last row when one or none is left; once nothing is left
	 * to pull, what comes next; or, with no exercise at all, the
	 * first run's empty state. The (today) layout renders it once (`ListPane`):
	 * the phone's Today and, on the desktop, the column beside the open exercise,
	 * whose row is lit (`currentId`). The desktop logs from the pane, so a row has
	 * no + there, and New exercise is the band's +, at every width.
	 */
	let {
		day,
		empty,
		daily,
		dance,
		lessonDays,
		upNextId,
		currentId,
		rowSearch,
		appUpdate,
		onlog,
		oncreate,
		onrefused,
		onskip
	}: {
		day: DayList<ExerciseItem>;
		/** No live exercise at all: the first run. */
		empty: boolean;
		/** The daily number, for "+ Next 5". */
		daily: number;
		dance: DanceSlug;
		/** Each lesson's class day. */
		lessonDays: Record<number, string>;
		/** The session's next row (while a session is on). */
		upNextId: number | null;
		/** The exercise open beside the list. */
		currentId: number | null;
		/** Appended to each row's link. */
		rowSearch: string;
		appUpdate: AppUpdate | null;
		/** A row's +: its log popup (the phone). */
		onlog: (exerciseId: number) => void;
		/** New exercise: its sheet. */
		oncreate: () => void;
		/** Next was refused: the layout's toast says why. */
		onrefused: (message: string) => void;
		/** Not today, from a row's swipe: the layout posts it and shows the toast. */
		onskip: (exerciseId: number) => void;
	} = $props();

	/** The row whose "Not today" is showing (one at a time); a tap anywhere else closes it. */
	let swiped = $state<{ key: string; side: Side } | null>(null);

	/** "Wed 28 Oct" for a lesson's row, null for any other type. */
	/**
	 * The Warm-up card's drag. A long press on a warm-up row lifts it (a plain tap still
	 * opens the exercise, the + still logs); the arithmetic is the routine editor's
	 * (`$lib/gestures/drag`). One post on drop, of the ids the card shows; the new order
	 * is drawn (`pending`) until the reload answers, and dropped on a refusal.
	 */
	let pending = $state<number[] | null>(null);
	let drag = $state<{ id: number; from: number; to: number; dy: number; step: number } | null>(
		null
	);
	let warmList = $state<HTMLElement>();
	let lastDown = { x: 0, y: 0, pointerId: 0 };

	const shownWarm = $derived.by(() => {
		const rows = day.rows.filter((r) => r.list === 'warmup');
		if (!pending) return rows;
		const at = (r: (typeof rows)[number]) => pending!.indexOf(r.exercise.id);
		// A row the reload brought in that the drop did not know stays after the dropped ones.
		return [...rows].sort((a, b) => {
			const ia = at(a);
			const ib = at(b);
			return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib);
		});
	});

	// The finger is already down when a long press lifts a row: its next moves must not
	// become a scroll. The listener is there from the start (a handler added mid-gesture
	// can come too late for the browser) and does nothing unless a row is lifted.
	$effect(() => {
		const list = warmList;
		if (!list) return;
		const hold = (ev: TouchEvent) => {
			if (drag && ev.cancelable) ev.preventDefault();
		};
		list.addEventListener('touchmove', hold, { passive: false });
		return () => list.removeEventListener('touchmove', hold);
	});

	const press = longPress({
		ms: 350,
		tolerancePx: 8,
		enabled: () => drag === null && shownWarm.length > 1,
		onLongPress: (id) => startDrag(id)
	});

	function startDrag(id: number) {
		const els = [...(warmList?.querySelectorAll<HTMLElement>(':scope > li[data-warm-row]') ?? [])];
		const index = els.findIndex((el) => el.dataset.warmRow === String(id));
		if (index < 0) return;
		swiped = null;
		const boxes = els.map((el) => el.getBoundingClientRect());
		const centers = boxes.map((b) => b.top + b.height / 2 + window.scrollY);
		const startY = lastDown.y;
		const startScroll = window.scrollY;
		drag = { id, from: index, to: index, dy: 0, step: boxes[index].height };

		const { top, bottom } = dragEdges(
			document.querySelector('[data-slim-band]')?.getBoundingClientRect() ?? null,
			document.querySelector('[data-tab-bar]')?.getBoundingClientRect() ?? null,
			parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--band-row-h')) || 0,
			window.innerHeight
		);
		let y = startY;
		let frame = 0;
		const update = () => {
			if (!drag) return;
			const dy = y - startY + (window.scrollY - startScroll);
			drag.dy = dy;
			drag.to = dropIndex(centers, centers[index] + dy, index);
		};
		const scroll = () => {
			const v = autoScroll(y, top, bottom);
			if (v !== 0) {
				window.scrollBy(0, v);
				update();
			}
			frame = requestAnimationFrame(scroll);
		};
		const onmove = (ev: PointerEvent) => {
			y = ev.clientY;
			update();
		};
		const finish = (commit: boolean) => {
			cancelAnimationFrame(frame);
			window.removeEventListener('pointermove', onmove);
			window.removeEventListener('pointerup', onup);
			window.removeEventListener('pointercancel', oncancel);
			window.removeEventListener('keydown', onkey);
			const done = drag;
			drag = null;
			if (commit && done && done.to !== done.from) void drop(done.from, done.to);
		};
		const onup = () => finish(true);
		const oncancel = () => finish(false);
		const onkey = (ev: KeyboardEvent) => {
			if (ev.key === 'Escape') finish(false);
		};
		window.addEventListener('pointermove', onmove);
		window.addEventListener('pointerup', onup);
		window.addEventListener('pointercancel', oncancel);
		window.addEventListener('keydown', onkey);
		frame = requestAnimationFrame(scroll);
	}

	async function drop(from: number, to: number) {
		const ids = moved(
			shownWarm.map((r) => r.exercise.id),
			from,
			to
		);
		pending = ids;
		const result = await actAt(`/${dance}`, 'warmupOrder', { ids: ids.join(',') });
		pending = null;
		const refused = refusalMessage(result, 'Could not save the order. Try again.');
		if (refused) onrefused(refused);
	}

	const dragOf = (i: number, id: number) =>
		({
			offset: !drag ? 0 : drag.id === id ? drag.dy : shiftFor(i, drag.from, drag.to, drag.step),
			lifted: drag?.id === id,
			moving: drag !== null
		}) as const;

	const lessonDayOf = (e: { lessonId: number | null }) => {
		const d = e.lessonId === null ? undefined : lessonDays[e.lessonId];
		return d ? classDayLabel(d, day.today) : null;
	};
</script>

<svelte:window
	onpointerdown={(e) => {
		if (swiped && !(e.target as Element).closest?.(`[data-swipe="${swiped.key}"]`)) swiped = null;
	}}
/>

{#if appUpdate?.state === 'available'}
	<AppUpdateBar update={appUpdate} />
{/if}

{#if empty}
	<div class="pt-10">
		<EmptyState
			icon="calendar"
			title="Nothing to practise yet"
			body="Build a routine from your figures, or add a custom exercise."
		>
			{#snippet action()}
				<div class="flex w-[260px] flex-col gap-2">
					<a
						href={resolve('/[dance]/(moves)/routines', { dance })}
						class={button('primary', 'md', true)}><Icon name="route" size={20} />Build a routine</a
					>
					<button type="button" class={button('secondary', 'md', true)} onclick={oncreate}
						><Icon name="plus" size={20} />New exercise</button
					>
				</div>
			{/snippet}
		</EmptyState>
	</div>
{:else}
	{#if day.nothingLeft}
		<div class="pb-3.5"><NothingLeft next={day.nothingLeft} {dance} today={day.today} /></div>
	{/if}

	{@const labels = listLabels(day)}
	{@const practiceRows = day.rows.filter((r) => r.list === 'practice')}
	{#snippet rowsOf(rows: typeof day.rows, draggable = false)}
		{#each rows as row, i (row.exercise.id)}
			<ExerciseRow
				{row}
				{dance}
				today={day.today}
				lessonDay={lessonDayOf(row.exercise)}
				upNext={row.exercise.id === upNextId}
				current={row.exercise.id === currentId}
				search={rowSearch}
				onlog={() => onlog(row.exercise.id)}
				onskip={row.kind === 'done' ? undefined : () => onskip(row.exercise.id)}
				swiped={swiped?.key === `today:${row.exercise.id}` ? swiped.side : null}
				onswipe={(side) => (swiped = side ? { key: `today:${row.exercise.id}`, side } : null)}
				drag={draggable ? dragOf(i, row.exercise.id) : undefined}
			/>
		{/each}
	{/snippet}

	{#if labels.warmup && shownWarm.length > 0}
		<section aria-labelledby="today-warmup-h" class="flex flex-col gap-2 pb-3.5">
			<h2 id="today-warmup-h" class={SECTION_LABEL}>{labels.warmup}</h2>
			<!-- A long press lifts a row to drag; its tail click must not also open the exercise. -->
			<ul
				class="{GROUP} select-none [-webkit-touch-callout:none]"
				bind:this={warmList}
				onpointerdown={(e) => {
					const id = (e.target as Element)
						.closest?.('li[data-warm-row]')
						?.getAttribute('data-warm-row');
					if (id === null || id === undefined || e.button !== 0) return;
					lastDown = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
					press.down(Number(id), e.clientX, e.clientY);
				}}
				onpointermove={(e) => press.move(e.clientX, e.clientY)}
				onpointerup={() => press.up()}
				onpointercancel={() => press.up()}
				// A link drags as a link (the browser's own drag cancels the pointer): not these.
				ondragstart={(e) => e.preventDefault()}
				oncontextmenu={(e) => {
					if (drag) e.preventDefault();
				}}
				onclickcapture={(e) => {
					if (press.swallow()) {
						e.preventDefault();
						e.stopPropagation();
					}
				}}
			>
				{@render rowsOf(shownWarm, true)}
			</ul>
		</section>
	{/if}

	{#if practiceRows.length > 0 || day.showNext}
		<section aria-labelledby="today-list-h" class="flex flex-col gap-2">
			<h2 id="today-list-h" class={SECTION_LABEL}>{labels.practice}</h2>
			<ul class={GROUP}>
				{@render rowsOf(practiceRows)}
				{#if day.showNext}<NextRow {dance} {daily} {onrefused} />{/if}
			</ul>
		</section>
	{/if}
{/if}
