<script lang="ts">
	import { guarded, leaveOrAsk } from '$lib/unsaved/guard.svelte';
	import { resolve } from '$app/paths';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import HeroCard from '$lib/components/ui/HeroCard.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { FIELD, GROUP, SECTION_LABEL, TEXTAREA, button } from '$lib/components/ui/styles';
	import RoutineMenu from '$lib/components/routines/RoutineMenu.svelte';
	import SlotList from '$lib/components/routines/SlotList.svelte';
	import SlotPicker from '$lib/components/routines/SlotPicker.svelte';
	import SelectionBar from '$lib/components/routines/SelectionBar.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import { act, type Field } from '$lib/components/routines/act';
	import type { PickFrom, RowView, Swiped } from '$lib/components/routines/types';
	import {
		anchorAfter,
		anchorAlternative,
		anchorBefore,
		anchorBetween,
		canBridge,
		type Anchor,
		type Candidate
	} from '$lib/routines/fit';
	import { extractBlock, inOrder } from '$lib/routines/selection';
	import { moved } from '$lib/gestures/drag';
	import { longPress } from '$lib/longpress';
	import {
		bandCompact,
		factBadges,
		factsOf,
		failurePlace,
		seamLabel,
		selectionTitle,
		slotMeta
	} from '$lib/routines/page';
	import { longDayLabel } from '$lib/format';
	import type { IconName } from '$lib/icons/icons';
	import type { ActionData, PageData, SubmitFunction } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let editing = $state(false);
	/** The slot tapped open, by id. One at a time. */
	let expanded = $state<number | null>(null);
	let selecting = $state(false);
	/** Selected slot ids, in tap order. */
	let selected = $state<number[]>([]);
	let swiped = $state<Swiped>(null);
	let dragging = $state(false);
	let flash = $state<number | null>(null);
	let naming = $state(false);
	/** The band's ⋯ sheet. */
	let menuOpen = $state(false);
	let editForm = $state<HTMLFormElement>();
	/**
	 * The `form` whose page banner was dismissed. Raw, not a deep proxy, so it
	 * stays the same object as `form`: the next refusal is a new object, and
	 * its banner shows.
	 */
	let dismissed = $state.raw<ActionData | null>(null);
	let picker = $state<{
		title: string;
		anchor: Anchor;
		insertAt: number | null;
		stepId: number | null;
	} | null>(null);
	let toast = $state<{ id: number; message: string; undo: () => void } | null>(null);
	let toastSeq = 0;

	/*
	 * Optimistic overlays, cleared when their action returns — by which time
	 * `act` has re-run the load, so the server's state takes over. While any is
	 * in flight the seams are hidden: they were computed for the order on the
	 * server, not the one on screen.
	 */
	let order = $state<number[] | null>(null);
	let gone = $state<number[]>([]);
	let goneOptions = $state<string[]>([]);
	let pending = $state(0);

	const routine = $derived(data.routine);
	/**
	 * Where the last refusal shows: under the slot it was aimed at (on a long
	 * routine a banner at the top is off-screen), under its field, or in a
	 * banner — a slot id that names no slot here included.
	 */
	const place = $derived(
		failurePlace(
			form,
			data.slots.map((s) => s.id)
		)
	);
	/** The routine-level refusal, until it is dismissed. */
	const bannerMessage = $derived(
		place?.where === 'banner' && dismissed !== form ? place.message : null
	);

	const positionNames = $derived(new Map(data.positions.map((p) => [p.id, p.name])));
	const posName = (id: number) => positionNames.get(id) ?? 'an untagged position';
	/** Live figures and variations, by id. A slot's figure missing here is archived. */
	const figuresById = $derived(
		new Map(data.candidates.filter((c) => c.kind === 'figure').map((c) => [c.id, c]))
	);

	const figureHref = (id: number) =>
		resolve('/[dance]/figures/[id]', { dance: data.dance.slug, id: String(id) });
	const routineHref = (id: number) =>
		resolve('/[dance]/routines/[id]', { dance: data.dance.slug, id: String(id) });

	function optionName(id: number): string {
		const name = data.labels[id] ?? 'a figure';
		return figuresById.has(id) ? name : `${name} (archived)`;
	}

	/** What does not connect below server row `i`, worded; null when it connects. */
	function seamOf(i: number): RowView['seam'] {
		const p = data.positionSeams.find((s) => s.after === i);
		const t = data.timingSeams.find((s) => s.after === i);
		const next = (p ?? t)?.next;
		if (next === undefined) return null;
		const a = data.edges[i];
		const b = data.edges[next];
		return {
			label: seamLabel(
				p && a.end !== null ? { end: posName(a.end), next: b.starts.map(posName) } : null,
				t ? { ready: a.next, next: b.startCounts } : null
			),
			next,
			bridge: canBridge(data.candidates, anchorBetween(a, b))
		};
	}

	/** The slots as shown: the server's, with any in-flight reorder or delete applied. */
	const shown = $derived.by(() => {
		const byId = new Map(data.slots.map((slot, i) => [slot.id, { slot, edges: data.edges[i], i }]));
		const ids = (order ?? data.slots.map((s) => s.id)).filter(
			(id) => !gone.includes(id) && byId.has(id)
		);
		return ids.map((id) => byId.get(id)!);
	});
	const stale = $derived(pending > 0 || dragging);

	const rows: RowView[] = $derived(
		shown.map(({ slot, edges, i }) => {
			const isRoutine = slot.childId !== null;
			const main = slot.figureIds[0] as number | undefined;
			return {
				id: slot.id,
				title: isRoutine
					? (slot.childName ?? 'a routine')
					: main === undefined
						? 'Empty — nothing to call here'
						: optionName(main),
				meta: slotMeta(
					edges,
					posName,
					isRoutine ? (data.childSlots[slot.childId as number] ?? 0) : null
				),
				empty: !isRoutine && main === undefined,
				note: slot.note,
				href: isRoutine
					? routineHref(slot.childId as number)
					: main === undefined
						? null
						: figureHref(main),
				isRoutine,
				alternatives: slot.figureIds
					.slice(1)
					.filter((f) => !goneOptions.includes(`${slot.id}:${f}`))
					.map((f) => ({ id: f, label: optionName(f), href: figureHref(f) })),
				canAddAlternative: !isRoutine && main !== undefined && figuresById.has(main),
				failure: place?.where === 'slot' && place.stepId === slot.id ? place.message : null,
				seam: stale ? null : seamOf(i)
			};
		})
	);

	const facts = $derived(
		factsOf(data.starts.map(posName), data.end === null ? null : posName(data.end))
	);
	const badges = $derived(
		factBadges({
			slots: data.slots.length,
			breaks: data.breaks.length,
			timingBreaks: data.timingBreaks.length,
			loops: data.loops
		})
	);
	const danceable = $derived(data.starts.length > 0);

	const practiseHref = $derived(
		data.exerciseId === null
			? resolve(`/${data.dance.slug}/player?routine=${routine.id}`)
			: resolve(`/${data.dance.slug}/player?routine=${routine.id}&exercise=${data.exerciseId}`)
	);

	/* ── Talking to the server ─────────────────────────────────────────── */

	async function send(name: string, fields: Record<string, Field>) {
		pending++;
		try {
			return await act(name, fields);
		} finally {
			pending--;
		}
	}

	function showToast(message: string, undo: () => void) {
		toast = { id: ++toastSeq, message, undo };
	}

	async function reorder(id: number, to: number) {
		const ids = rows.map((r) => r.id);
		const from = ids.indexOf(id);
		if (from < 0 || to < 0 || to >= ids.length || to === from) return;
		order = moved(ids, from, to);
		await send('reorder', { stepId: id, index: to });
		order = null;
	}

	async function remove(ids: number[]) {
		const message =
			ids.length === 1
				? `Slot ${rows.findIndex((r) => r.id === ids[0]) + 1} deleted`
				: `${ids.length} slots deleted`;
		gone = [...gone, ...ids];
		swiped = null;
		if (expanded !== null && ids.includes(expanded)) expanded = null;
		const result = await send('deleteMany', { stepIds: ids });
		gone = gone.filter((id) => !ids.includes(id));
		if (result.type === 'success' && result.data?.snapshot) {
			const snapshot = JSON.stringify(result.data.snapshot);
			showToast(message, () => send('restore', { snapshot }));
		}
	}

	async function removeAlternative(stepId: number, figureId: number, label: string) {
		const key = `${stepId}:${figureId}`;
		goneOptions = [...goneOptions, key];
		swiped = null;
		const result = await send('removeOption', { stepId, figureId });
		goneOptions = goneOptions.filter((k) => k !== key);
		if (result.type === 'success') {
			showToast(`Removed ${label}`, () => send('restoreOption', { stepId, figureId }));
		}
	}

	function openPicker(at: number, from: PickFrom | null) {
		const edges = from === null ? null : shown[from.row]?.edges;
		const anchor: Anchor =
			edges == null
				? { kind: 'none' }
				: from?.side === 'between'
					? (anchorBetween(edges, shown[from.next]?.edges ?? edges) ?? { kind: 'none' })
					: from?.side === 'after'
						? anchorAfter(edges)
						: anchorBefore(edges);
		const title =
			from === null
				? 'Add a figure'
				: from.side === 'between'
					? `Add between slots ${from.row + 1} and ${from.next + 1}`
					: from.side === 'after'
						? `Add after slot ${from.row + 1}`
						: `Add before slot ${from.row + 1}`;
		picker = { title, anchor, insertAt: at, stepId: null };
	}

	function openAlternative(stepId: number) {
		const slot = data.slots.find((s) => s.id === stepId);
		if (!slot) return;
		const main = figuresById.get(slot.figureIds[0]);
		const anchor = anchorAlternative(main, slot.figureIds);
		if (!main || !anchor) return;
		picker = { title: `Alternative for ${main.label}`, anchor, insertAt: null, stepId };
	}

	async function pick(c: Candidate) {
		const p = picker;
		picker = null;
		if (!p) return;
		if (p.stepId !== null) {
			await send('addOption', { stepId: p.stepId, figureId: c.id });
			return;
		}
		const content: Record<string, Field> =
			c.kind === 'figure' ? { figureId: c.id } : { childId: c.id };
		const result = await send('insert', { at: p.insertAt ?? rows.length, ...content });
		if (result.type === 'success' && typeof result.data?.stepId === 'number') {
			const id = result.data.stepId;
			flash = id;
			// The new slot opens expanded, as if tapped — its note field and
			// + Alternative ready. Expansion is off while selecting, so a pick made
			// from Add above / below ends selection mode first.
			if (selecting) stopSelecting();
			expanded = id;
		}
	}

	$effect(() => {
		if (flash === null) return;
		const timer = setTimeout(() => (flash = null), 1200);
		return () => clearTimeout(timer);
	});

	/* ── Selection ─────────────────────────────────────────────────────── */

	const press = longPress({
		ms: 450,
		tolerancePx: 10,
		enabled: () => !selecting && !dragging,
		onLongPress: (id) => {
			selecting = true;
			selected = [id];
			expanded = null;
			swiped = null;
		}
	});

	function tap(id: number) {
		if (swiped) {
			swiped = null;
			return;
		}
		if (selecting) {
			selected = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
			if (selected.length === 0) selecting = false;
			return;
		}
		expanded = expanded === id ? null : id;
	}

	/*
	 * A press anywhere outside the open card closes it. Capture phase, so it is
	 * seen before anything under the finger handles it; a press on the open
	 * card itself — its revealed Delete or Open included — is left to the card.
	 */
	$effect(() => {
		if (!swiped) return;
		const key = swiped.key;
		const close = (e: PointerEvent) => {
			const card = document.querySelector(`[data-swipe="${key}"]`);
			if (card && e.target instanceof Node && card.contains(e.target)) return;
			swiped = null;
		};
		window.addEventListener('pointerdown', close, true);
		return () => window.removeEventListener('pointerdown', close, true);
	});

	function stopSelecting() {
		selecting = false;
		selected = [];
	}

	const extractBlocked = $derived(extractBlock(rows, selected, data.embeddedIn));

	/**
	 * Add above / below the one selected slot. The selection is KEPT while the
	 * picker is open: closing it without picking leaves you where you were.
	 * Picking ends selection and opens the new slot expanded (see `pick`).
	 */
	function addAround(side: 'after' | 'before') {
		const i = rows.findIndex((r) => r.id === selected[0]);
		if (i < 0) return;
		openPicker(side === 'after' ? i + 1 : i, { row: i, side });
	}

	/**
	 * The Make routine form's enhance callback. The form goes through
	 * `use:guarded`, so a typed name is unsaved work the sheet asks about before
	 * closing; on success the new embedded slot opens expanded like any new slot.
	 */
	const extracted: SubmitFunction =
		() =>
		async ({ result, update }) => {
			await update();
			if (result.type !== 'success') return;
			naming = false;
			stopSelecting();
			const id = result.data && 'stepId' in result.data ? result.data.stepId : undefined;
			if (typeof id === 'number') {
				flash = id;
				expanded = id;
			}
		};
</script>

<svelte:head><title>{routine.name} · {data.dance.label}</title></svelte:head>

<svelte:window
	onkeydown={(e) => {
		// Not while a sheet is open: that Escape closes the sheet, not the selection.
		if (e.key === 'Escape' && selecting && !naming && !menuOpen && picker === null) stopSelecting();
	}}
/>

{#snippet back()}
	{#if selecting}
		<BandButton icon="close" label="Stop selecting" onclick={stopSelecting} />
	{:else if editing}
		<BandButton
			icon="close"
			label="Stop editing"
			onclick={() => leaveOrAsk(editForm ?? null, () => (editing = false), 'Stop editing')}
		/>
	{:else}
		<BandButton
			icon="back"
			label="Back to Moves"
			href={resolve('/[dance]/routines', { dance: data.dance.slug })}
		/>
	{/if}
{/snippet}

{#snippet actions()}
	<BandButton
		icon="pencil"
		label="Edit routine"
		onclick={() => {
			editing = true;
			window.scrollTo({ top: 0 });
		}}
	/>
	{#if data.slots.length > 0}
		<BandButton icon="more" label="More actions" onclick={() => (menuOpen = true)} />
	{/if}
{/snippet}

{#snippet practise()}
	<!-- The player picks the song: count only, or any of this dance's ready ones. -->
	<HeroCard title="Practise" meta="Count only or with a song" href={practiseHref} />
{/snippet}

<Screen
	title={selecting ? selectionTitle(selected.length) : editing ? 'Edit routine' : routine.name}
	compact={selecting || (!editing && bandCompact(routine.name))}
	left={back}
	right={selecting || editing ? undefined : actions}
	hero={selecting || editing || !danceable ? undefined : practise}
>
	<div class="flex flex-col gap-2 {selecting ? 'pb-40' : 'pb-4'}">
		{#if editing}
			{#if place && (place.where === 'edit' || place.where === 'banner')}
				<Banner kind="error" title={place.message} />
			{/if}
			<form
				id="edit-form"
				bind:this={editForm}
				method="POST"
				action="?/rename"
				class="space-y-3"
				use:guarded={{
					label: 'Routine edits',
					submit:
						() =>
						async ({ update, result }) => {
							await update({ reset: false });
							if (result.type === 'success') editing = false;
						}
				}}
			>
				<label class="block">
					<span class="mb-1 block text-[13px] text-muted">Name</span>
					<input name="name" required maxlength="200" value={routine.name} class={FIELD} />
				</label>
				<label class="block">
					<span class="mb-1 block text-[13px] text-muted">Notes</span>
					<textarea name="notes" rows="5" maxlength="2000" class={TEXTAREA}
						>{routine.notes ?? ''}</textarea
					>
				</label>
				<button
					type="submit"
					class="h-12 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink"
					>Save</button
				>
			</form>
			<!-- Not behind `use:enhance`: the action redirects to the copy, and a full
			     navigation is what makes it obvious you are now editing the copy. -->
			<form method="POST" action="?/duplicate">
				<button type="submit" class="h-11 w-full rounded-xl border border-line text-[14px]"
					>Duplicate routine</button
				>
			</form>
			<form
				method="POST"
				action="?/archive"
				onsubmit={(e) => {
					if (!confirm(`Archive “${routine.name}”? Its slots and practice history are kept.`)) {
						e.preventDefault();
					}
				}}
			>
				<button type="submit" class="h-11 w-full rounded-xl text-[14px] text-danger"
					>Archive routine</button
				>
			</form>
		{:else}
			<!-- Selecting shows only the slots. -->
			{#if !selecting}
				{#if bannerMessage}
					<Banner kind="error" title={bannerMessage} ondismiss={() => (dismissed = form)} />
				{/if}
				{#if routine.notes}
					<p class="px-1 text-[15px] leading-[1.45] font-medium whitespace-pre-line text-ink-2">
						{routine.notes}
					</p>
				{/if}
				{#if facts}
					<div class="flex flex-col gap-2 px-1 pt-0.5 pb-1">
						<p class="text-[14px] font-semibold text-ink-2">
							Starts from <b class="font-extrabold text-ink">{facts.from}</b
							>{#if facts.to !== null}&nbsp;· ends at <b class="font-extrabold text-ink"
									>{facts.to}</b
								>{/if}
						</p>
						{#if badges.length > 0}
							<div class="flex flex-wrap gap-1.5">
								{#each badges as b (b.text)}
									<Badge tone={b.tone}
										>{#if b.loop}<Icon name="repeat" size={14} />{/if}{b.text}</Badge
									>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			{/if}

			{#if data.slots.length === 0}
				<EmptyState
					icon="route"
					title="No slots yet"
					body="The first slot is where the routine starts. Add a figure, then build from it."
				>
					{#snippet action()}
						<button type="button" class={button('primary')} onclick={() => openPicker(0, null)}
							><Icon name="plus" size={20} />Add a figure</button
						>
					{/snippet}
				</EmptyState>
			{:else}
				<section>
					<h2 class="{SECTION_LABEL} mb-2 pt-1.5">Slots · {rows.length}</h2>
					<SlotList
						{rows}
						{expanded}
						{selecting}
						{selected}
						{swiped}
						{flash}
						{press}
						onswipe={(key, side) => (swiped = side === null ? null : { key, side })}
						ontap={tap}
						ondragstart={() => {
							dragging = true;
							expanded = null;
							swiped = null;
						}}
						ondragend={() => (dragging = false)}
						onreorder={reorder}
						ondelete={(id) => remove([id])}
						onremoveAlt={removeAlternative}
						onaddAlt={openAlternative}
						onnote={(id, note) => send('note', { stepId: id, note })}
						onadd={openPicker}
					/>
				</section>
			{/if}

			{#if !selecting && (data.exerciseId !== null || data.taughtIn.length > 0)}
				<h2 class="{SECTION_LABEL} pt-3.5">More</h2>
				<ul class={GROUP}>
					{#if data.exerciseId !== null}
						{@render moreRow(
							resolve('/[dance]/exercises/[id]', {
								dance: data.dance.slug,
								id: String(data.exerciseId)
							}),
							'repeat',
							'Exercise',
							'History, how often, active'
						)}
					{/if}
					{#each data.taughtIn as lesson (lesson.id)}
						{@render moreRow(
							resolve('/[dance]/lessons/[id]', {
								dance: data.dance.slug,
								id: String(lesson.id)
							}),
							'lessons',
							lesson.title,
							`Taught in · ${longDayLabel(lesson.lessonDay)}`
						)}
					{/each}
				</ul>
			{/if}
		{/if}
	</div>
</Screen>

{#snippet moreRow(href: string, icon: IconName, title: string, meta: string)}
	<li>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the caller passes a resolved href -->
		<a {href} class="flex min-h-16 items-center gap-3 py-2 pr-3.5 pl-4">
			<span class="flex-none text-accent-text"><Icon name={icon} size={24} /></span>
			<span class="flex min-w-0 flex-1 flex-col gap-0.5">
				<span class="text-[16px] leading-tight font-bold text-ink">{title}</span>
				<span class="text-[13px] text-muted">{meta}</span>
			</span>
			<span class="text-chevron"><Icon name="chevron-right" size={20} /></span>
		</a>
	</li>
{/snippet}

<RoutineMenu
	open={menuOpen}
	title={routine.name}
	canSelect={data.slots.length > 0}
	onselect={() => {
		selecting = true;
		selected = [];
		expanded = null;
		swiped = null;
	}}
	onclose={() => (menuOpen = false)}
/>

{#if selecting}
	<SelectionBar
		count={selected.length}
		{extractBlocked}
		onabove={() => addAround('before')}
		onbelow={() => addAround('after')}
		onduplicate={() => {
			// Selection from ⋯ starts empty: nothing to post yet.
			if (selected.length === 0) return;
			const ids = inOrder(rows, selected);
			stopSelecting();
			send('duplicateMany', { stepIds: ids });
		}}
		onextract={() => (naming = true)}
		ondelete={() => {
			if (selected.length === 0) return;
			const ids = inOrder(rows, selected);
			stopSelecting();
			remove(ids);
		}}
	/>
{/if}

<SlotPicker
	open={picker !== null}
	title={picker?.title ?? ''}
	anchor={picker?.anchor ?? { kind: 'none' }}
	candidates={data.candidates}
	positionName={posName}
	onpick={pick}
	onclose={() => (picker = null)}
/>

<Sheet title="Make a routine" open={naming} onclose={() => (naming = false)}>
	<form
		method="POST"
		action="?/extract"
		class="space-y-3"
		use:guarded={{ label: 'New routine name', submit: extracted }}
	>
		{#each inOrder(rows, selected) as id (id)}
			<input type="hidden" name="stepIds" value={id} />
		{/each}
		{#if place && (place.where === 'extract' || place.where === 'banner')}
			<Banner kind="error" title={place.message} />
		{/if}
		<label class="block">
			<span class="mb-1 block text-[12px] font-medium text-ink-2">Name</span>
			<input name="name" required maxlength="200" placeholder="Hammerlock combo" class={FIELD} />
		</label>
		<p class="text-[12px] text-muted">
			The {selected.length === 1 ? 'slot moves' : `${selected.length} slots move`} into the new routine,
			and it takes their place here.
		</p>
		<button
			type="submit"
			class="h-11 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink"
			>Make routine</button
		>
	</form>
</Sheet>

<Toast
	toast={toast && { id: toast.id, message: toast.message, action: 'Undo' }}
	bottom="calc(1rem + env(safe-area-inset-bottom))"
	onaction={() => {
		const t = toast;
		toast = null;
		t?.undo();
	}}
	ondismiss={() => (toast = null)}
/>
