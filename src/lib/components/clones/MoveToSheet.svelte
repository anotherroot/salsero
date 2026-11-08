<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { gotoWhenSettled } from '$lib/sheets/history.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import Segmented from '$lib/components/ui/Segmented.svelte';
	import { GROUP, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import {
		cancelLabel,
		loadFailed,
		CONTINUE,
		KEEP_MINE,
		MOVE_BUTTON,
		MOVE_FAILED,
		MOVE_NOTE,
		MOVE_SUB,
		PRACTICE_STAYS,
		TWINS_ONE_GOES,
		USE_GROUPS,
		movedToast,
		moveTitle,
		placeLabel,
		placeMeta,
		twinChoiceLabel,
		whichSub,
		whichTitle
	} from '$lib/clones/view';
	import type { CopyTarget, MoveItem, MoveOffer, MovePreview } from '$lib/types';
	import { dropped } from './dropped.svelte';

	/**
	 * Move to… (board C4 p3): the person's own lesson into a group they own or
	 * edit, as a draft; it leaves their lessons. With more than one group, a
	 * radio per group first, as Copy to… has. For each figure, routine and drill
	 * of theirs it brings: its name, why it is kept by default, and "Keep mine
	 * as well" | "Use the group’s". When something that goes has twins, "Which
	 * …?" asks first, as Copy to… does. A landed move opens the group's lesson,
	 * whose page shows the toast (`dropped`).
	 */
	let {
		open,
		onclose,
		offer,
		current,
		action = '?/moveTo'
	}: {
		open: boolean;
		onclose: () => void;
		offer: MoveOffer;
		/** The page's lesson: what moves. */
		current: number;
		action?: string;
	} = $props();

	const uid = $props.id();
	let picked = $state(0);
	let preview = $state<MovePreview | null>(null);
	let failed = $state(false);
	let busy = $state(false);
	let refused = $state<string | null>(null);
	let choices = $state<Record<string, 'keep' | 'group'>>({});
	let asking = $state(false);
	let step = $state(0);
	let use = $state<Record<string, number>>({});
	let form: HTMLFormElement | undefined = $state();

	const target = $derived<CopyTarget>(offer.targets[picked] ?? offer.targets[0]);
	const teamId = (t: CopyTarget) => (t.place.kind === 'team' ? String(t.place.teamId) : '');
	const keyOf = (i: MoveItem) => `${i.kind}:${i.id}`;
	const options = [
		{ value: 'keep' as const, label: KEEP_MINE },
		{ value: 'group' as const, label: USE_GROUPS }
	];
	/** Something dropped is practised: its practice stays with the archived copy. */
	const practiceStays = $derived(
		preview?.items.some((i) => i.practised && choices[keyOf(i)] === 'group') ?? false
	);

	$effect(() => {
		if (!open) return;
		picked = 0;
		refused = null;
		asking = false;
	});

	/** The rows for the group picked; each open and each group starts from the defaults. */
	$effect(() => {
		if (!open) return;
		const t = target;
		preview = null;
		failed = false;
		use = {};
		choices = {};
		const ask = new AbortController();
		const q = new URLSearchParams({ id: String(current), into: teamId(t) });
		fetch(`/api/clones/move?${q}`, { signal: ask.signal })
			.then(async (res) => {
				if (!res.ok) throw new Error(String(res.status));
				const p = (await res.json()) as MovePreview;
				preview = p;
				choices = Object.fromEntries(
					p.items.map((i) => [keyOf(i), i.keepByDefault ? 'keep' : 'group'] as const)
				);
				use = Object.fromEntries(p.twins.map((t) => [t.gene, t.from]));
			})
			.catch(() => {
				if (!ask.signal.aborted) failed = true;
			});
		return () => ask.abort();
	});

	const question = $derived(preview?.twins[step] ?? null);

	function close() {
		asking = false;
		onclose();
	}

	/** Move: through the twins questions first, when there are any. */
	function go() {
		if (preview && preview.twins.length > 0) {
			step = 0;
			asking = true;
			return;
		}
		form?.requestSubmit();
	}

	async function next() {
		if (!preview) return;
		if (step < preview.twins.length - 1) {
			step += 1;
			return;
		}
		asking = false;
		await tick();
		form?.requestSubmit();
	}

	const NOTE =
		'flex items-start gap-3 rounded-2xl bg-step p-3.5 text-[14px] leading-[1.4] text-ink-2';
</script>

<Sheet title={moveTitle(offer.title, target.place)} sub={MOVE_SUB} {open} onclose={close} tall>
	<div class="flex flex-col gap-3">
		{#if refused}<Banner kind="error">{refused}</Banner>{/if}
		{#if offer.targets.length > 1}
			<fieldset class="flex flex-col gap-1.5">
				<legend class="sr-only">{moveTitle(offer.title, target.place)}</legend>
				<div class={GROUP}>
					{#each offer.targets as t, i (teamId(t))}
						<label class="flex min-h-[64px] cursor-pointer items-center gap-3 px-4 py-2">
							<span class="flex min-w-0 flex-1 flex-col">
								<span class="text-[16px] font-bold text-ink">{placeLabel(t.place)}</span>
								<span class="text-[13px] text-muted"
									>{placeMeta(t.role, t.usedBytes, t.limitBytes)}</span
								>
							</span>
							<input
								type="radio"
								name="{uid}-into"
								value={teamId(t)}
								checked={picked === i}
								class="size-[22px] flex-none cursor-pointer"
								style="accent-color: var(--color-accent)"
								onchange={() => {
									picked = i;
									refused = null;
								}}
							/>
						</label>
					{/each}
				</div>
			</fieldset>
		{/if}

		{#if failed}
			<Banner kind="error">{loadFailed()}</Banner>
		{:else if !preview}
			<div class="grid place-items-center py-6 text-muted"><Spinner /></div>
		{:else}
			{#if preview.items.length > 0}
				<ul class={GROUP}>
					{#each preview.items as item (keyOf(item))}
						<li class="flex flex-col gap-2 px-4 py-3">
							<div class="flex items-baseline gap-3">
								<span class="min-w-0 flex-1 text-[16px] font-bold text-ink">{item.label}</span>
								<span class="flex-none text-right text-[13px] text-muted">{item.why}</span>
							</div>
							<Segmented
								items={options}
								bind:value={choices[keyOf(item)]}
								name="{uid}-{keyOf(item)}"
								label={item.label}
							/>
						</li>
					{/each}
				</ul>
				<p class={NOTE}>
					<span class="mt-px flex-none text-muted"><Icon name="undo" size={20} /></span>
					<span class="min-w-0 flex-1">{MOVE_NOTE}</span>
				</p>
				{#if practiceStays}
					<p class={NOTE}>
						<span class="mt-px flex-none text-muted"><Icon name="info" size={20} /></span>
						<span class="min-w-0 flex-1">{PRACTICE_STAYS}</span>
					</p>
				{/if}
			{:else}
				<p class={NOTE}>{preview.goes}</p>
			{/if}
		{/if}
	</div>

	{#snippet footer()}
		<form
			bind:this={form}
			method="POST"
			{action}
			class="grid grid-cols-[1fr_2fr] gap-2"
			use:enhance={({ cancel }) => {
				// One move per tap: a second tap while the first is out is dropped.
				if (busy) return cancel();
				busy = true;
				refused = null;
				const place = placeLabel(target.place);
				return async ({ result, update }) => {
					try {
						if (result.type === 'redirect') {
							// This lesson is archived: its page gives way to the group's, which shows the toast.
							dropped.set(movedToast(place), result.location, page.url.pathname);
							close();
							try {
								await gotoWhenSettled(result.location, { replaceState: true, invalidateAll: true });
							} catch (err) {
								dropped.clear();
								throw err;
							}
						} else if (result.type === 'failure') {
							const data = result.data as { message?: unknown } | undefined;
							refused = typeof data?.message === 'string' ? data.message : MOVE_FAILED;
						} else if (result.type === 'error') {
							refused = MOVE_FAILED;
						} else {
							await update();
						}
					} finally {
						busy = false;
					}
				};
			}}
		>
			<input type="hidden" name="into" value={teamId(target)} />
			<input type="hidden" name="choices" value={JSON.stringify(choices)} />
			<input type="hidden" name="use" value={JSON.stringify(use)} />
			<button type="button" class={button('tertiary', 'md', true)} onclick={close}
				>{cancelLabel()}</button
			>
			<button
				type="button"
				class={button('primary', 'md', true)}
				disabled={busy || !preview}
				aria-busy={busy}
				onclick={go}
			>
				{#if busy}
					<Spinner />
				{:else}
					<Icon name="move-to" size={20} />{MOVE_BUTTON}
				{/if}
			</button>
		</form>
	{/snippet}
</Sheet>

{#if question && preview}
	<Sheet
		title={whichTitle(question.label)}
		sub={whichSub(question.kind, question.choices.length, placeLabel(target.place))}
		open={open && asking}
		onclose={() => (asking = false)}
	>
		<div class="flex flex-col gap-3">
			<fieldset class="flex flex-col gap-1.5">
				<legend class={SECTION_LABEL}>{whichTitle(question.label)}</legend>
				<div class={GROUP}>
					{#each question.choices as c (c.id)}
						<label class="flex min-h-[64px] cursor-pointer items-center gap-3 px-4 py-2">
							<span class="flex min-w-0 flex-1 flex-col">
								<span class="text-[16px] font-bold text-ink">{twinChoiceLabel(c.place)}</span>
								<span class="text-[13px] text-muted">{c.meta}</span>
							</span>
							<input
								type="radio"
								name="{uid}-which-{step}"
								value={c.id}
								checked={use[question.gene] === c.id}
								class="size-[22px] flex-none cursor-pointer"
								style="accent-color: var(--color-accent)"
								onchange={() => (use = { ...use, [question.gene]: c.id })}
							/>
						</label>
					{/each}
				</div>
			</fieldset>
			<p class={NOTE}>
				<span class="mt-px flex-none text-muted"><Icon name="info" size={20} /></span>
				<span class="min-w-0 flex-1">{TWINS_ONE_GOES}</span>
			</p>
		</div>
		{#snippet footer()}
			<button type="button" class={button('primary', 'md', true)} disabled={busy} onclick={next}
				>{CONTINUE}</button
			>
		{/snippet}
	</Sheet>
{/if}
