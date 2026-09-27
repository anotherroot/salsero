<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let editing = $state(false);

	const routine = $derived(data.routine);
	const failure = $derived(form && 'message' in form ? form.message : null);

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
	const figureName = $derived(new Map(data.figures.map((f) => [f.id, f.name])));

	/**
	 * `data.breaks` holds FLAT slot indices, which line up with `data.slots` only
	 * while no slot holds a child. When one does, the count still tells the truth
	 * but the indices point at the wrong rows, so nothing is marked per slot.
	 */
	const breakAfter = $derived(data.hasChild ? new Set<number>() : new Set(data.breaks));

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
		return figureName.get(id) ?? 'archived figure';
	}

	/** Figures not already in this slot — adding one twice is a no-op, so don't offer it. */
	function addable(figureIds: number[]) {
		return data.figures.filter((f) => !figureIds.includes(f.id));
	}

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
	<button
		type="button"
		class="h-10 rounded-lg px-3 text-[14px] font-medium text-accent"
		onclick={() => (editing = !editing)}>{editing ? 'Done' : 'Edit'}</button
	>
</header>

<main class="space-y-6 px-4 pt-4 pb-4">
	{#if bannerFailure}
		<p class={errorBox} role="alert">{bannerFailure}</p>
	{/if}

	{#if editing}
		<form
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
				<a
					href={practiseHref}
					class="grid h-12 w-full place-items-center rounded-xl bg-accent text-[15px] font-semibold text-accent-ink"
					>Practise</a
				>
			{/if}
		</section>
	{/if}

	{#if facts.length > 0 || data.breaks.length > 0 || (!data.loops && data.slots.length > 0)}
		<p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
			{#if facts.length > 0}
				<span>{facts.join(' · ')}</span>
			{/if}
			{#if data.breaks.length > 0}
				<span class={hint}>{data.breaks.length} break{data.breaks.length === 1 ? '' : 's'}</span>
			{/if}
			{#if !data.loops && data.slots.length > 0}
				<span class={hint}>does not loop</span>
			{/if}
		</p>
	{/if}

	<section>
		<h2 class="text-[12px] font-medium tracking-wide text-muted uppercase">Slots</h2>
		<p class="mt-1 mb-2 text-[12px] text-muted">
			A slot's variants all have to end in the same place — any one of them can be danced there.
		</p>
		{#if data.slots.length === 0}
			<p class="text-[13px] text-muted">
				Nothing yet. Add a figure below — the first slot is where the routine starts.
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
									<p class="text-[12px] text-muted">Its own slots are edited on its page.</p>
								{:else if slot.figureIds.length === 0}
									<p class="text-[13px] text-muted">
										Empty — nothing to call here. Add a variant or remove the slot.
									</p>
								{:else}
									<ul class="space-y-1">
										{#each slot.figureIds as figureId (figureId)}
											<li class="flex items-center gap-2">
												<span class="min-w-0 flex-1 text-[15px]">{optionName(figureId)}</span>
												{#if slot.figureIds.length > 1}
													<form method="POST" action="?/removeOption" use:enhance>
														<input type="hidden" name="stepId" value={slot.id} />
														<input type="hidden" name="figureId" value={figureId} />
														<button type="submit" class="h-9 px-2 text-[13px] text-danger"
															>Remove</button
														>
													</form>
												{/if}
											</li>
										{/each}
									</ul>
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
							</div>
						</div>

						{#if slot.childId === null && addable(slot.figureIds).length > 0}
							<form
								method="POST"
								action="?/addOption"
								class="mt-2 flex items-center gap-2"
								use:enhance
							>
								<input type="hidden" name="stepId" value={slot.id} />
								<select name="figureId" class={select} aria-label="Add a variant">
									{#each addable(slot.figureIds) as figure (figure.id)}
										<option value={figure.id}>{figure.name}</option>
									{/each}
								</select>
								<button type="submit" class={step}>+ Variant</button>
							</form>
						{/if}

						<form method="POST" action="?/note" class="mt-2 flex items-center gap-2" use:enhance>
							<input type="hidden" name="stepId" value={slot.id} />
							<input
								name="note"
								value={slot.note ?? ''}
								maxlength="200"
								placeholder="Note for this slot"
								aria-label="Note for slot {i + 1}"
								class="min-w-0 flex-1 rounded-lg border border-line bg-plane px-2 py-1 text-[15px]"
							/>
							<button type="submit" class="h-9 px-2 text-[13px] font-medium text-accent"
								>Save</button
							>
						</form>

						<div class="mt-2 flex items-center gap-2">
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
							<form
								method="POST"
								action="?/remove"
								class="ml-auto"
								use:enhance
								onsubmit={(e) => {
									if (!confirm(`Remove slot ${i + 1}?`)) e.preventDefault();
								}}
							>
								<input type="hidden" name="stepId" value={slot.id} />
								<button type="submit" class="h-11 px-3 text-[14px] text-danger">Remove slot</button>
							</form>
						</div>

						{#if failedSlot === slot.id && failure}
							<p class="mt-2 {errorBox}" role="alert">{failure}</p>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="space-y-3">
		<h2 class="text-[12px] font-medium tracking-wide text-muted uppercase">Add a slot</h2>
		{#if data.figures.length === 0}
			<p class="text-[13px] text-muted">
				No figures in this dance yet.
				<a class="text-accent" href={resolve('/[dance]/figures', { dance: data.dance.slug })}
					>Add one first</a
				>.
			</p>
		{:else}
			<form method="POST" action="?/addFigure" class="flex items-center gap-2" use:enhance>
				<select name="figureId" class={select} aria-label="Figure to add">
					{#each data.figures as figure (figure.id)}
						<option value={figure.id}>{figure.name}</option>
					{/each}
				</select>
				<button type="submit" class={step}>+ Slot</button>
			</form>
		{/if}
		{#if data.embeddable.length > 0}
			<form method="POST" action="?/addChild" class="flex items-center gap-2" use:enhance>
				<select name="childId" class={select} aria-label="Routine to embed">
					{#each data.embeddable as child (child.id)}
						<option value={child.id}>{child.name}</option>
					{/each}
				</select>
				<button type="submit" class={step}>+ Routine</button>
			</form>
		{/if}
	</section>
</main>
