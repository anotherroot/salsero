<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { refreshWhenSettled } from '$lib/sheets/history.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { GROUP, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import {
		ALREADY_THERE,
		CANCEL,
		COMPARE_FAILED,
		CONTINUE,
		COPY_FAILED,
		RESTORE,
		TWINS_ONE_GOES,
		WHAT_GOES,
		copiedToast,
		copyButton,
		copySub,
		copyTitle,
		existingNote,
		placeLabel,
		placeMeta,
		twinChoiceLabel,
		whichSub,
		whichTitle
	} from '$lib/clones/view';
	import type { CopyOffer, CopyPlanView, CopyTarget } from '$lib/types';
	import SyncSheet from './SyncSheet.svelte';
	import { SYNC_MENU } from '$lib/clones/step-view';

	/**
	 * Copy to… (board C4 p1, p2): the page's row into your app or a group you
	 * own or edit. A radio per place with your role and its space; under it what
	 * goes and what the place has already (fetched for the place picked). When
	 * something that goes has twins in your app, "Which Enchufla · Doble?" asks
	 * for each family before the copy (p4): only one version goes. A place that
	 * holds a member already gets Sync… instead of Copy (Restore first when
	 * it is archived): the server answers that member, and Sync opens on it
	 * over this sheet, posting to the member's own page. A landed copy closes
	 * the sheet and `ondone` shows its toast.
	 */
	let {
		open,
		onclose,
		offer,
		current,
		ondone,
		action = '?/copyTo'
	}: {
		open: boolean;
		onclose: () => void;
		offer: CopyOffer;
		/** The page's row: what goes. */
		current: number;
		/** A copy landed: its toast, and the copy's page. */
		ondone: (message: string, href: string) => void;
		action?: string;
	} = $props();

	const uid = $props.id();
	let picked = $state(0);
	let plan = $state<CopyPlanView | null>(null);
	let failed = $state(false);
	let busy = $state(false);
	let refused = $state<string | null>(null);
	/** The twins questions' level: open, and which question. */
	let asking = $state(false);
	let step = $state(0);
	let use = $state<Record<string, number>>({});
	/** The chosen twin's archived member in the place, as the copy answered it: Restore applies to it. */
	let archivedTwin = $state<number | null>(null);
	/** The member already there: Sync opens on it, posting to its own page. */
	let comparing = $state<{ id: number; action: string } | null>(null);
	let compareOpen = $state(false);
	let form: HTMLFormElement | undefined = $state();

	const target = $derived<CopyTarget>(offer.targets[picked] ?? offer.targets[0]);
	const intoValue = (t: CopyTarget) => (t.place.kind === 'team' ? String(t.place.teamId) : 'mine');
	const draft = $derived(
		target.place.kind === 'team' && (offer.kind === 'lesson' || offer.kind === 'song')
	);
	/** The member the place holds: of this row's family, or of the twin chosen (archived). */
	const here = $derived(
		target.existing ?? (archivedTwin === null ? null : { id: archivedTwin, archived: true })
	);

	$effect(() => {
		if (!open) return;
		picked = 0;
		refused = null;
		asking = false;
	});

	/**
	 * The cards for the place picked; none while it holds a member already.
	 * Each open and each place starts with no answers: another place's twins
	 * answers never travel with this one.
	 */
	$effect(() => {
		if (!open) return;
		const t = target;
		plan = null;
		failed = false;
		use = {};
		archivedTwin = null;
		if (t.existing) return;
		const ask = new AbortController();
		const q = new URLSearchParams({
			kind: offer.kind,
			id: String(current),
			into: intoValue(t)
		});
		fetch(`/api/clones/copy?${q}`, { signal: ask.signal })
			.then(async (res) => {
				if (!res.ok) throw new Error(String(res.status));
				const p = (await res.json()) as CopyPlanView;
				plan = p;
				use = Object.fromEntries(p.twins.map((t) => [t.gene, t.from]));
			})
			.catch(() => {
				if (!ask.signal.aborted) failed = true;
			});
		return () => ask.abort();
	});

	const question = $derived(plan?.twins[step] ?? null);

	function close() {
		asking = false;
		onclose();
	}

	/** Copy: through the twins questions first, when there are any. */
	function go() {
		if (here) return form?.requestSubmit();
		if (plan && plan.twins.length > 0) {
			step = 0;
			asking = true;
			return;
		}
		form?.requestSubmit();
	}

	async function next() {
		if (!plan) return;
		if (step < plan.twins.length - 1) {
			step += 1;
			return;
		}
		asking = false;
		await tick();
		form?.requestSubmit();
	}

	const CAPTION = 'text-[12px] font-bold tracking-wide text-muted uppercase';
	const CARD = 'flex flex-col gap-1 rounded-2xl bg-step p-3.5 text-[14px] leading-[1.4] text-ink-2';
</script>

<Sheet
	title={copyTitle(offer.title)}
	sub={copySub(offer.kind, target.place, offer.fromMine)}
	{open}
	onclose={close}
	tall
>
	<div class="flex flex-col gap-3">
		{#if refused}<Banner kind="error">{refused}</Banner>{/if}
		<fieldset class="flex flex-col gap-1.5">
			<legend class="sr-only">{copyTitle(offer.title)}</legend>
			<div class={GROUP}>
				{#each offer.targets as t, i (intoValue(t))}
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
							value={intoValue(t)}
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

		{#if here}
			<Banner kind="info">{existingNote(target.place, here.archived)}</Banner>
		{:else if failed}
			<Banner kind="error">{COMPARE_FAILED}</Banner>
		{:else if !plan}
			<div class="grid place-items-center py-6 text-muted"><Spinner /></div>
		{:else}
			<section class={CARD} aria-labelledby="{uid}-goes">
				<h3 id="{uid}-goes" class={CAPTION}>{WHAT_GOES}</h3>
				<p>{plan.goes}</p>
			</section>
			{#if plan.already.length > 0}
				<section class={CARD} aria-labelledby="{uid}-already">
					<h3 id="{uid}-already" class={CAPTION}>{ALREADY_THERE}</h3>
					{#each plan.already as line (line)}<p>{line}</p>{/each}
				</section>
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
				// One copy per tap: a second tap while the first is out is dropped.
				if (busy) return cancel();
				busy = true;
				refused = null;
				const place = target.place;
				const asDraft = draft;
				return async ({ result }) => {
					try {
						if (result.type === 'success') {
							const data = (result.data ?? {}) as Record<string, unknown>;
							if (typeof data.copied === 'number' && typeof data.href === 'string') {
								close();
								ondone(copiedToast(place, asDraft), data.href);
								await refreshWhenSettled();
							} else if (
								typeof data.existing === 'number' &&
								typeof data.from === 'number' &&
								typeof data.href === 'string'
							) {
								comparing = { id: data.existing, action: `${data.href}?/sync` };
								compareOpen = true;
							} else if (typeof data.restore === 'number') {
								// The chosen twin's member there is archived (or this row's, archived since
								// the page loaded): Restore applies to it, with the same answers.
								archivedTwin = data.restore;
							}
						} else if (result.type === 'failure') {
							const data = result.data as { message?: unknown } | undefined;
							refused = typeof data?.message === 'string' ? data.message : COPY_FAILED;
						} else {
							refused = COPY_FAILED;
						}
					} finally {
						busy = false;
					}
				};
			}}
		>
			<input type="hidden" name="into" value={intoValue(target)} />
			<!-- A member of this row's own family there: no twins answers apply. -->
			<input type="hidden" name="use" value={target.existing ? '' : JSON.stringify(use)} />
			{#if here?.archived}
				<input type="hidden" name="restore" value={here.id} />
			{/if}
			<button type="button" class={button('tertiary', 'md', true)} onclick={close}>{CANCEL}</button>
			<button
				type="button"
				class={button('primary', 'md', true)}
				disabled={busy || (!here && !plan)}
				aria-busy={busy}
				onclick={go}
			>
				{#if busy}
					<Spinner />
				{:else if here?.archived}
					<Icon name="undo" size={20} />{RESTORE}
				{:else if here}
					<Icon name="refresh" size={20} />{SYNC_MENU}
				{:else}
					<Icon name="copy" size={20} />{copyButton(offer.kind, target.place)}
				{/if}
			</button>
		</form>
	{/snippet}
</Sheet>

{#if question && plan}
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
			<p
				class="flex items-start gap-3 rounded-2xl bg-step p-3.5 text-[14px] leading-[1.4] text-ink-2"
			>
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

{#if comparing}
	<SyncSheet
		open={open && compareOpen}
		onclose={async () => {
			compareOpen = false;
			close();
			// The place's member may have come back (Restore) or changed (Take).
			await refreshWhenSettled();
		}}
		kind={offer.kind}
		id={comparing.id}
		action={comparing.action}
	/>
{/if}
