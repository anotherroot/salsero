<script lang="ts">
	import { enhance } from '$app/forms';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import { resolve } from '$app/paths';
	import { dateLabel } from '$lib/format';
	import type { ActionData, PageData, SubmitFunction } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let editing = $state(false);

	/** Which slot's sheet is open, by id — not by index, which moves when a slot does. */
	let editingSlot = $state<number | null>(null);
	let adding = $state(false);
	let practising = $state(false);

	const routine = $derived(data.routine);
	const failure = $derived(form && 'message' in form ? form.message : null);

	/**
	 * The slot the sheet is showing, looked up fresh each time `data` changes so
	 * an edit made inside the sheet is reflected in it. It goes null when the
	 * slot stops existing, which is what closes the sheet after a remove.
	 */
	const edited = $derived(data.slots.find((s) => s.id === editingSlot) ?? null);
	const editedIndex = $derived(data.slots.findIndex((s) => s.id === editingSlot));

	/**
	 * Close a sheet once its action succeeded, and leave it open when it did not —
	 * a refusal has a message to show, and showing it behind a sheet that just
	 * shut is the same as not showing it.
	 */
	const closeOn = (shut: () => void): SubmitFunction => {
		return () =>
			async ({ result, update }) => {
				await update();
				if (result.type === 'success' || result.type === 'redirect') shut();
			};
	};
	const closeAdd = closeOn(() => (adding = false));
	const closeEdit = closeOn(() => (editingSlot = null));

	/**
	 * The slot a failure was aimed at, when the action named one. Every slot has
	 * its own set of forms and they share their messages, so a refusal is printed
	 * under the slot it belongs to rather than only in the banner at the top —
	 * which, on a long routine, is off-screen and never scrolled to.
	 */
	const failedSlot = $derived(
		// `typeof` rather than a cast: `'stepId' in form` narrows the member that
		// does not declare it to `unknown`, and this is the one check that turns that
		// back into a number without asserting anything about the wire format.
		form && 'stepId' in form && typeof form.stepId === 'number' ? form.stepId : null
	);

	/**
	 * The banner keeps everything the slots do not: the four routine-level actions,
	 * and a slot-scoped failure whose id names no slot on the page — a stale or
	 * foreign id, which would otherwise be printed nowhere at all.
	 */
	const bannerFailure = $derived(
		failure !== null && data.slots.some((s) => s.id === failedSlot) ? null : failure
	);

	/**
	 * Ids to names. The shape layer speaks in position and figure ids, and every
	 * diagnostic on this page has to be readable, so both are resolved here.
	 */
	const positionName = $derived(new Map(data.positions.map((p) => [p.id, p.name])));
	/** Live figures and variations by id, for the pickers. */
	const live = $derived(new Set(data.figures.map((f) => f.id)));

	/**
	 * `data.breaks` holds FLAT slot indices, which line up with `data.slots` only
	 * while no slot holds a child. When one does, the count still tells the truth
	 * but the indices point at the wrong rows, so nothing is marked per slot.
	 */
	const breakAfter = $derived(data.hasChild ? new Set<number>() : new Set(data.breaks));
	/**
	 * Row → the next row it fails to reach on the count. Keyed by `slots` index
	 * on the server (`timingSeams`), unlike `breakAfter`, so it stays on the right
	 * row past an archived-only slot or an embedded routine.
	 */
	const seamAfter = $derived(new Map(data.timingSeams.map((s) => [s.after, s.next])));

	/** "5→1", or "1/5→?" when the alternatives disagree on where they leave the count. */
	function timingLabel(i: number): string {
		const t = data.slotTiming[i];
		if (!t || t.starts.length === 0) return '';
		return `${t.starts.join('/')}→${t.next ?? '?'}`;
	}

	/**
	 * The player link. Two whole literals rather than one built by concatenation:
	 * `resolve()` types its argument against the route table, and a string joined
	 * with `+` widens to `string` and stops typechecking. `exercise=` is left off
	 * entirely when there is no exercise, never sent as the text "null".
	 */
	const practiseHref = $derived(
		data.exerciseId === null
			? resolve(`/${data.dance.slug}/player?routine=${routine.id}`)
			: resolve(`/${data.dance.slug}/player?routine=${routine.id}&exercise=${data.exerciseId}`)
	);

	/**
	 * The same run, over a song. The player already loads a song's beat grid from
	 * `?song=`, so choosing one here is a link rather than anything the page has
	 * to fetch — and `routine=` rides alongside exactly as it does for the count.
	 */
	const songHref = (songId: number) =>
		data.exerciseId === null
			? resolve(`/${data.dance.slug}/player?routine=${routine.id}&song=${songId}`)
			: resolve(
					`/${data.dance.slug}/player?routine=${routine.id}&song=${songId}&exercise=${data.exerciseId}`
				);

	function positionNames(ids: number[]): string {
		return ids.map((id) => positionName.get(id) ?? 'an untagged position').join(', ');
	}

	/**
	 * The two things worth stating, joined rather than laid out with a separator
	 * per clause: "Ends at" can stand alone, and a hard `·` before it would dangle.
	 */
	const facts = $derived(
		[
			data.starts.length > 0 ? `Starts from ${positionNames(data.starts)}` : null,
			data.end === null ? null : `Ends at ${positionName.get(data.end) ?? 'an untagged position'}`
		].filter((f) => f !== null)
	);

	/**
	 * Whether there is anything to dance. `starts` is empty exactly when the
	 * routine flattens to nothing — no slots, or only slots whose figures are all
	 * archived — which is also when the player would have nothing to call.
	 */
	const danceable = $derived(data.starts.length > 0);

	/**
	 * A figure a slot still lists but the library no longer offers — archived, or
	 * gone. Named rather than blank, because the remove form beside it is the only
	 * way to clear it out.
	 */
	function optionName(id: number): string {
		const name = data.labels[id] ?? 'a figure';
		return live.has(id) ? name : `${name} (archived)`;
	}

	/**
	 * Figures and variations that could stand in for this slot's: not already in it, and landing
	 * where its first figure lands — same hold, same next count. When the slot's
	 * figures are all archived there is nothing to compare against, so everything
	 * is offered and `addOption` decides.
	 */
	function addable(figureIds: number[]) {
		const first = data.figures.find((f) => figureIds.includes(f.id));
		return data.figures.filter(
			(f) => !figureIds.includes(f.id) && (!first || (f.end === first.end && f.next === first.next))
		);
	}

	/**
	 * The add-slot picker in two steps: a figure, then — only when it has
	 * variations — which version. `pickedFigure` starts undefined so the select
	 * binds to its first option.
	 */
	let pickedFigure = $state<number | undefined>(undefined);
	const baseFigures = $derived(data.figures.filter((f) => f.parentId === null));
	const pickedVersions = $derived(
		data.figures.filter((f) => f.id === pickedFigure || f.parentId === pickedFigure)
	);

	const hint = 'rounded-full bg-danger/10 px-2 py-0.5 font-medium text-danger';
	const errorBox = 'rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger';
	const step = 'h-11 rounded-xl border border-line px-3 text-[14px] disabled:opacity-30';
	const select = 'h-11 min-w-0 flex-1 rounded-xl border border-line bg-raised px-3 text-[15px]';
</script>

<svelte:head><title>{routine.name} · {data.dance.label}</title></svelte:head>

<header
	class="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-plane/95 px-2 py-2 backdrop-blur"
	style="padding-top: max(env(safe-area-inset-top), 0.5rem)"
>
	<a
		href={resolve('/[dance]/routines', { dance: data.dance.slug })}
		class="grid size-11 place-items-center rounded-full text-[22px] text-ink-2"
		aria-label="Back to routines">‹</a
	>
	<h1 class="min-w-0 flex-1 truncate text-[17px] font-semibold">{routine.name}</h1>
	<!--
		Done SAVES: it submits the edit form (by `form=`, since the header is
		outside it). A refused save keeps you editing with the message showing, so
		nothing typed is lost; a successful one closes edit mode.
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
</header>

<main class="space-y-6 px-4 pt-4 pb-4">
	{#if bannerFailure}
		<p class={errorBox} role="alert">{bannerFailure}</p>
	{/if}

	{#if editing}
		<form
			id="edit-form"
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
				<input
					name="name"
					required
					maxlength="200"
					value={routine.name}
					class="w-full rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent"
				/>
			</label>
			<label class="block">
				<span class="mb-1 block text-[13px] text-muted">Notes</span>
				<textarea
					name="notes"
					rows="5"
					maxlength="2000"
					class="w-full rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent"
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
					<!-- Nothing to choose between, so no sheet to choose in. -->
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
		<div class="flex items-center justify-between gap-3">
			<h2 class="text-[12px] font-medium tracking-wide text-muted uppercase">Slots</h2>
			<button type="button" onclick={() => (adding = true)} class={step}>+ Add</button>
		</div>
		<p class="mt-1 mb-2 text-[12px] text-muted">
			A slot's alternatives all have to land in the same hold and on the same count — any one of
			them can be danced there.
		</p>
		{#if data.slots.length === 0}
			<p class="text-[13px] text-muted">
				Nothing yet. Add a figure — the first slot is where the routine starts.
			</p>
		{:else}
			<ul class="space-y-2">
				{#each data.slots as slot, i (slot.id)}
					<li class="rounded-xl border border-line bg-raised p-3">
						<div class="flex items-start gap-3">
							<span
								class="grid size-6 shrink-0 place-items-center rounded-full bg-accent/15 text-[12px] font-semibold text-accent"
								>{i + 1}</span
							>
							<div class="min-w-0 flex-1 space-y-1">
								{#if slot.childId !== null}
									<p class="text-[15px]">
										Routine: <a
											class="font-medium text-accent"
											href={resolve('/[dance]/routines/[id]', {
												dance: data.dance.slug,
												id: String(slot.childId)
											})}>{slot.childName ?? 'a routine'}</a
										>
									</p>
									{#if timingLabel(i)}
										<p class="text-[12px] text-muted">{timingLabel(i)}</p>
									{/if}
								{:else if slot.figureIds.length === 0}
									<p class="text-[13px] text-muted">Empty — nothing to call here.</p>
								{:else}
									<!--
										Alternatives read as one line rather than a stack of rows: any of
										them can be danced at this point, so they belong together, and the
										row has to stay short enough to scan a whole routine at a glance.
									-->
									<p class="text-[15px]">
										{slot.figureIds.map(optionName).join('  /  ')}
										{#if timingLabel(i)}
											<span class="text-[12px] text-muted">· {timingLabel(i)}</span>
										{/if}
									</p>
								{/if}
								{#if slot.note}
									<p class="text-[12px] text-muted">{slot.note}</p>
								{/if}
								{#if (data.slotStarts[i]?.length ?? 0) > 0}
									<p class="text-[12px] text-muted">
										Entered from {positionNames(data.slotStarts[i])}
									</p>
								{/if}
								{#if breakAfter.has(i)}
									<p class="text-[12px]">
										<span class={hint}>break — the hands don't reach the next slot</span>
									</p>
								{/if}
								{#if seamAfter.has(i)}
									<p class="text-[12px]">
										<span class={hint}
											>timing — ends ready for {data.slotTiming[i]?.next}, next slot starts on {data.slotTiming[
												seamAfter.get(i) ?? i + 1
											]?.starts.join(' or ')}</span
										>
									</p>
								{/if}
							</div>
							<button
								type="button"
								onclick={() => (editingSlot = slot.id)}
								class="h-9 shrink-0 px-2 text-[13px] font-medium text-accent">Edit</button
							>
						</div>

						{#if failedSlot === slot.id && failure}
							<p class="mt-2 {errorBox}" role="alert">{failure}</p>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
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

<!--
	Adding and editing both live behind a button in a sheet. Inline selects made
	every slot three controls tall, which on a phone meant a four-slot routine
	could not be seen at once — and seeing the shape of the routine is the whole
	point of this page.
-->
<Sheet title="Add to this routine" open={adding} onclose={() => (adding = false)}>
	{#if data.figures.length === 0}
		<p class="text-[13px] text-muted">
			No figures in this dance yet.
			<a class="text-accent" href={resolve('/[dance]/figures', { dance: data.dance.slug })}
				>Add one first</a
			>.
		</p>
	{:else}
		<form method="POST" action="?/addFigure" class="space-y-2" use:enhance={closeAdd}>
			<span class="text-[13px] font-medium">A figure</span>
			<select bind:value={pickedFigure} class="{select} w-full" aria-label="Figure to add">
				{#each baseFigures as figure (figure.id)}
					<option value={figure.id}>{figure.name}</option>
				{/each}
			</select>
			{#if pickedVersions.length > 1}
				<select name="figureId" class="{select} w-full" aria-label="Which version">
					{#each pickedVersions as v (v.id)}
						<option value={v.id}>{v.parentId === null ? 'Basic' : v.name}</option>
					{/each}
				</select>
			{:else}
				<input type="hidden" name="figureId" value={pickedFigure ?? ''} />
			{/if}
			<button type="submit" class="{step} w-full">Add slot</button>
		</form>
	{/if}

	{#if data.embeddable.length > 0}
		<form method="POST" action="?/addChild" class="mt-4 space-y-2" use:enhance={closeAdd}>
			<span class="text-[13px] font-medium">Another routine</span>
			<select name="childId" class="{select} w-full" aria-label="Routine to embed">
				{#each data.embeddable as child (child.id)}
					<option value={child.id}>{child.name}</option>
				{/each}
			</select>
			<button type="submit" class="{step} w-full">Embed routine</button>
		</form>
	{/if}
</Sheet>

<Sheet
	title={edited ? `Slot ${editedIndex + 1}` : 'Slot'}
	open={edited !== null}
	onclose={() => (editingSlot = null)}
>
	{#if edited}
		{@const slot = edited}
		{@const i = editedIndex}
		<div class="space-y-4">
			{#if slot.childId !== null}
				<p class="text-[13px] text-muted">
					This slot dances <span class="font-medium">{slot.childName ?? 'a routine'}</span>. Its own
					slots are edited on its page.
				</p>
			{:else}
				<div class="space-y-1">
					<span class="text-[13px] font-medium">Alternatives</span>
					{#each slot.figureIds as figureId (figureId)}
						<div class="flex items-center gap-2">
							<span class="min-w-0 flex-1 text-[15px]">{optionName(figureId)}</span>
							{#if slot.figureIds.length > 1}
								<form method="POST" action="?/removeOption" use:enhance>
									<input type="hidden" name="stepId" value={slot.id} />
									<input type="hidden" name="figureId" value={figureId} />
									<button type="submit" class="h-9 px-2 text-[13px] text-danger">Remove</button>
								</form>
							{/if}
						</div>
					{/each}
					{#if addable(slot.figureIds).length > 0}
						<form method="POST" action="?/addOption" class="flex items-center gap-2" use:enhance>
							<input type="hidden" name="stepId" value={slot.id} />
							<select name="figureId" class={select} aria-label="Add an alternative">
								{#each addable(slot.figureIds) as figure (figure.id)}
									<option value={figure.id}>{figure.label}</option>
								{/each}
							</select>
							<button type="submit" class={step}>+ Alternative</button>
						</form>
					{:else}
						<p class="text-[12px] text-muted">
							No other figure lands in the same hold on the same count.
						</p>
					{/if}
				</div>
			{/if}

			<form
				method="POST"
				action="?/note"
				class="flex items-center gap-2"
				use:guarded={{ label: 'Slot note' }}
			>
				<input type="hidden" name="stepId" value={slot.id} />
				<input
					name="note"
					value={slot.note ?? ''}
					maxlength="200"
					placeholder="Note for this slot"
					aria-label="Note for slot {i + 1}"
					class="min-w-0 flex-1 rounded-lg border border-line bg-plane px-2 py-1 text-[15px]"
				/>
				<button type="submit" class="h-9 px-2 text-[13px] font-medium text-accent">Save</button>
			</form>

			<div class="flex items-center gap-2">
				<form method="POST" action="?/move" use:enhance>
					<input type="hidden" name="stepId" value={slot.id} />
					<input type="hidden" name="delta" value="-1" />
					<button
						type="submit"
						disabled={i === 0}
						class="grid size-11 place-items-center rounded-xl border border-line text-[18px] disabled:opacity-30"
						aria-label="Move up">↑</button
					>
				</form>
				<form method="POST" action="?/move" use:enhance>
					<input type="hidden" name="stepId" value={slot.id} />
					<input type="hidden" name="delta" value="1" />
					<button
						type="submit"
						disabled={i === data.slots.length - 1}
						class="grid size-11 place-items-center rounded-xl border border-line text-[18px] disabled:opacity-30"
						aria-label="Move down">↓</button
					>
				</form>
				<form method="POST" action="?/duplicateSlot" class="ml-auto" use:enhance={closeEdit}>
					<input type="hidden" name="stepId" value={slot.id} />
					<button type="submit" class="h-11 px-3 text-[14px] font-medium text-accent"
						>Duplicate</button
					>
				</form>
			</div>

			<form
				method="POST"
				action="?/remove"
				use:enhance={closeEdit}
				onsubmit={(e) => {
					if (!confirm(`Remove slot ${i + 1}?`)) e.preventDefault();
				}}
			>
				<input type="hidden" name="stepId" value={slot.id} />
				<button type="submit" class="h-11 w-full text-[14px] text-danger">Remove slot</button>
			</form>

			{#if failedSlot === slot.id && failure}
				<p class={errorBox} role="alert">{failure}</p>
			{/if}
		</div>
	{/if}
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
