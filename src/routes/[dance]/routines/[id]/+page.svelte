<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import { FIELD } from '$lib/components/ui/styles';
	import SlotList from '$lib/components/routines/SlotList.svelte';
	import SlotPicker from '$lib/components/routines/SlotPicker.svelte';
	import SelectionBar from '$lib/components/routines/SelectionBar.svelte';
	import UndoToast from '$lib/components/routines/UndoToast.svelte';
	import { act, type Field } from '$lib/components/routines/act';
	import type { RowView, Swiped } from '$lib/components/routines/types';
	import {
		anchorAfter,
		anchorAlternative,
		anchorBefore,
		type Anchor,
		type Candidate
	} from '$lib/routines/fit';
	import { extractBlock, inOrder } from '$lib/routines/selection';
	import type { RowEdges } from '$lib/routines/routines';
	import { moved } from '$lib/gestures/drag';
	import { longPress } from '$lib/longpress';
	import { dateLabel } from '$lib/format';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let editing = $state(false);
	let practising = $state(false);
	/** The slot tapped open, by id. One at a time. */
	let expanded = $state<number | null>(null);
	let selecting = $state(false);
	/** Selected slot ids, in tap order. */
	let selected = $state<number[]>([]);
	let swiped = $state<Swiped>(null);
	let dragging = $state(false);
	let flash = $state<number | null>(null);
	let naming = $state(false);
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
	const failure = $derived(form && 'message' in form ? (form.message ?? null) : null);

	/**
	 * The slot a failure was aimed at, when the action named one — printed under
	 * that slot rather than only in the banner, which on a long routine is
	 * off-screen. `typeof` rather than a cast: `'stepId' in form` narrows the
	 * members that do not declare it to `unknown`.
	 */
	const failedSlot = $derived(
		form && 'stepId' in form && typeof form.stepId === 'number' && 'message' in form
			? form.stepId
			: null
	);
	/** The banner keeps what the slots do not: routine-level failures, and a slot id that names no slot here. */
	const bannerFailure = $derived(
		failure !== null && data.slots.some((s) => s.id === failedSlot) ? null : failure
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

	function timingOf(id: number): string {
		const c = figuresById.get(id);
		return c ? `${c.startCounts.join('/')}→${c.next ?? '?'}` : '';
	}

	function metaOf(e: RowEdges): string {
		if (e.starts.length === 0) return '';
		const timing = `${e.startCounts.join('/')}→${e.next ?? '?'}`;
		const hands = `${e.starts.map(posName).join(' / ')} → ${e.end === null ? '?' : posName(e.end)}`;
		return `${timing} · ${hands}`;
	}

	/** What does not connect below server row `i`, worded; null when it connects. */
	function seamOf(i: number): RowView['seam'] {
		const p = data.positionSeams.find((s) => s.after === i);
		const t = data.timingSeams.find((s) => s.after === i);
		const next = (p ?? t)?.next;
		if (next === undefined) return null;
		const a = data.edges[i];
		const b = data.edges[next];
		const parts: string[] = [];
		if (p && a.end !== null) {
			parts.push(
				`ends in ${posName(a.end)}, next starts from ${b.starts.map(posName).join(' or ')}`
			);
		}
		if (t) parts.push(`ready for ${a.next}, next starts on ${b.startCounts.join(' or ')}`);
		return { label: parts.join(' · '), next };
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
				meta: metaOf(edges),
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
					.map((f) => ({ id: f, label: optionName(f), timing: timingOf(f), href: figureHref(f) })),
				canAddAlternative: !isRoutine && main !== undefined && figuresById.has(main),
				failure: failedSlot === slot.id ? failure : null,
				seam: stale ? null : seamOf(i)
			};
		})
	);

	const facts = $derived(
		[
			data.starts.length > 0 ? `Starts from ${data.starts.map(posName).join(', ')}` : null,
			data.end === null ? null : `Ends at ${posName(data.end)}`
		].filter((f) => f !== null)
	);
	const danceable = $derived(data.starts.length > 0);

	const practiseHref = $derived(
		data.exerciseId === null
			? resolve(`/${data.dance.slug}/player?routine=${routine.id}`)
			: resolve(`/${data.dance.slug}/player?routine=${routine.id}&exercise=${data.exerciseId}`)
	);
	const songHref = (songId: number) =>
		data.exerciseId === null
			? resolve(`/${data.dance.slug}/player?routine=${routine.id}&song=${songId}`)
			: resolve(
					`/${data.dance.slug}/player?routine=${routine.id}&song=${songId}&exercise=${data.exerciseId}`
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

	function openPicker(at: number, from: { row: number; side: 'after' | 'before' } | null) {
		const edges = from === null ? null : shown[from.row]?.edges;
		const anchor: Anchor =
			edges == null
				? { kind: 'none' }
				: from?.side === 'after'
					? anchorAfter(edges)
					: anchorBefore(edges);
		const title =
			from === null
				? 'Add a figure'
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
			flash = result.data.stepId;
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

	function stopSelecting() {
		selecting = false;
		selected = [];
	}

	const extractBlocked = $derived(extractBlock(rows, selected, data.embeddedIn));

	function addAround(side: 'after' | 'before') {
		const i = rows.findIndex((r) => r.id === selected[0]);
		stopSelecting();
		if (i < 0) return;
		openPicker(side === 'after' ? i + 1 : i, { row: i, side });
	}

	async function extract(e: SubmitEvent) {
		e.preventDefault();
		const name = String(new FormData(e.currentTarget as HTMLFormElement).get('name') ?? '');
		const result = await send('extract', { stepIds: inOrder(rows, selected), name });
		if (result.type === 'success') {
			naming = false;
			stopSelecting();
			if (typeof result.data?.stepId === 'number') flash = result.data.stepId;
		}
	}

	const hint = 'rounded-full bg-danger/10 px-2 py-0.5 font-medium text-danger';
	const errorBox = 'rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger';
</script>

<svelte:head><title>{routine.name} · {data.dance.label}</title></svelte:head>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && selecting && !naming) stopSelecting();
	}}
/>

<header
	class="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-plane/95 px-2 py-2 backdrop-blur"
	style="padding-top: max(env(safe-area-inset-top), 0.5rem)"
>
	{#if selecting}
		<button
			type="button"
			class="grid size-11 place-items-center rounded-full text-[20px] text-ink-2"
			aria-label="Stop selecting"
			onclick={stopSelecting}>×</button
		>
		<h1 class="min-w-0 flex-1 truncate text-[17px] font-semibold">{selected.length} selected</h1>
	{:else}
		<a
			href={resolve('/[dance]/routines', { dance: data.dance.slug })}
			class="grid size-11 place-items-center rounded-full text-[22px] text-ink-2"
			aria-label="Back to routines">‹</a
		>
		<h1 class="min-w-0 flex-1 truncate text-[17px] font-semibold">{routine.name}</h1>
		<!--
			Done SAVES: it submits the edit form (by `form=`, since the header is
			outside it). A refused save keeps you editing with the message showing.
		-->
		{#if editing}
			<button
				type="submit"
				form="edit-form"
				class="h-10 rounded-lg px-3 text-[14px] font-medium text-accent">Done</button
			>
		{:else}
			<button
				type="button"
				class="h-10 rounded-lg px-3 text-[14px] font-medium text-accent"
				onclick={() => (editing = true)}>Edit</button
			>
		{/if}
	{/if}
</header>

<main class="space-y-6 px-4 pt-4 {selecting ? 'pb-40' : 'pb-4'}">
	{#if bannerFailure}
		<p class={errorBox} role="alert">{bannerFailure}</p>
	{/if}

	{#if editing}
		<form
			id="edit-form"
			method="POST"
			action="?/rename"
			class="space-y-3"
			use:enhance={() =>
				async ({ update, result }) => {
					await update({ reset: false });
					if (result.type === 'success') editing = false;
				}}
		>
			<label class="block">
				<span class="mb-1 block text-[13px] text-muted">Name</span>
				<input name="name" required maxlength="200" value={routine.name} class={FIELD} />
			</label>
			<label class="block">
				<span class="mb-1 block text-[13px] text-muted">Notes</span>
				<textarea name="notes" rows="5" maxlength="2000" class={FIELD}
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
		<section class="space-y-3">
			{#if routine.notes}
				<p class="text-[15px] whitespace-pre-line">{routine.notes}</p>
			{/if}
			{#if danceable}
				{#if data.songs.length === 0}
					<a
						href={practiseHref}
						class="grid h-12 w-full place-items-center rounded-xl bg-accent text-[15px] font-semibold text-accent-ink"
						>Practise</a
					>
				{:else}
					<button
						type="button"
						onclick={() => (practising = true)}
						class="h-12 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink"
						>Practise</button
					>
				{/if}
			{/if}
			{#if data.exerciseId !== null}
				<a
					href={resolve('/[dance]/exercises/[id]', {
						dance: data.dance.slug,
						id: String(data.exerciseId)
					})}
					class="text-[14px] font-medium text-accent">Exercise →</a
				>
			{/if}
		</section>
	{/if}

	{#if facts.length > 0 || data.breaks.length > 0 || data.timingBreaks.length > 0 || (!data.loops && data.slots.length > 0)}
		<p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
			{#if facts.length > 0}
				<span>{facts.join(' · ')}</span>
			{/if}
			{#if data.breaks.length > 0}
				<span class={hint}>{data.breaks.length} break{data.breaks.length === 1 ? '' : 's'}</span>
			{/if}
			{#if data.timingBreaks.length > 0}
				<span class={hint}
					>{data.timingBreaks.length} timing break{data.timingBreaks.length === 1 ? '' : 's'}</span
				>
			{/if}
			{#if !data.loops && data.slots.length > 0}
				<span class={hint}>does not loop</span>
			{/if}
		</p>
	{/if}

	<section>
		<h2 class="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Slots</h2>
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
			onopen={(href) => goto(href)}
			onremoveAlt={removeAlternative}
			onaddAlt={openAlternative}
			onnote={(id, note) => send('note', { stepId: id, note })}
			onadd={openPicker}
		/>
	</section>

	{#if data.taughtIn.length > 0}
		<section>
			<h2 class="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Taught in</h2>
			<ul class="space-y-1">
				{#each data.taughtIn as lesson (lesson.id)}
					<li>
						<a
							class="text-[15px] text-accent"
							href={resolve('/[dance]/lessons/[id]', {
								dance: data.dance.slug,
								id: String(lesson.id)
							})}>{lesson.title}</a
						>
						<span class="text-[12px] text-muted">· {dateLabel(lesson.lessonDay)}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</main>

{#if selecting}
	<SelectionBar
		count={selected.length}
		{extractBlocked}
		onabove={() => addAround('before')}
		onbelow={() => addAround('after')}
		onduplicate={() => {
			const ids = inOrder(rows, selected);
			stopSelecting();
			send('duplicateMany', { stepIds: ids });
		}}
		onextract={() => (naming = true)}
		ondelete={() => {
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
	<form class="space-y-3" onsubmit={extract}>
		{#if bannerFailure}
			<p class={errorBox} role="alert">{bannerFailure}</p>
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

<Sheet title="Practise this routine" open={practising} onclose={() => (practising = false)}>
	<div class="space-y-2">
		<a
			href={practiseHref}
			class="grid h-12 w-full place-items-center rounded-xl border border-line text-[15px]"
			>To a count</a
		>
		<p class="pt-2 text-[12px] font-medium tracking-wide text-muted uppercase">Over a song</p>
		{#each data.songs as song (song.id)}
			<a
				href={songHref(song.id)}
				class="grid h-12 w-full place-items-center rounded-xl border border-line px-3 text-[15px]"
				>{song.title}</a
			>
		{/each}
	</div>
</Sheet>

<UndoToast
	toast={toast && { id: toast.id, message: toast.message }}
	onundo={() => {
		const t = toast;
		toast = null;
		t?.undo();
	}}
	ondismiss={() => (toast = null)}
/>
