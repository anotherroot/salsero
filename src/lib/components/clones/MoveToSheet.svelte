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
		continueLabel,
		keepMine,
		moveButton,
		moveFailed,
		moveNote,
		moveSub,
		practiceStays as practiceStaysLine,
		twinsOneGoes,
		useGroups,
		movedToast,
		moveTitle,
		placeLabel,
		placeMeta,
		twinChoiceLabel,
		whichSub,
		whichTitle
	} from '$lib/clones/view';
	import type { CopyTarget, MoveItem, MoveOffer, MovePreview } from '$lib/types';
	import { t } from '$lib/i18n/catalog';
	import { byteSize } from '$lib/format';
	import { livePlace } from '$lib/offline/places.svelte';
	import { splitMoveVideos } from '$lib/offline/move-videos';
	import { landOriginal } from '$lib/offline/upload-original';
	import { uploadOf } from '$lib/offline/uploads.svelte';
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
	const options = $derived([
		{ value: 'keep' as const, label: keepMine() },
		{ value: 'group' as const, label: useGroups() }
	]);
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

	/*
	 * Videos only on a phone (offline phase 4c, look B): the moved lesson is
	 * archived, so those this phone holds upload first and the lesson moves
	 * once they are up; those on another device can only stay behind.
	 */
	const videos = $derived(offer.phoneOnly ?? []);
	const split = $derived(splitMoveVideos(videos, (v) => livePlace(v)));
	const numberOf = (id: number) => videos.findIndex((v) => v.id === id) + 1;
	const pw = $derived(t().video.place.move);
	let uploading = $state(false);
	let without = $state('');
	/** The videos up so far in this run: each shows Uploaded while the next goes. */
	let landed = $state<number[]>([]);
	/** Counts the runs: one the sheet was closed on never moves the lesson. */
	let run = 0;
	/** Only videos on another device: the move goes without them, said on its button. */
	const onlyWithout = $derived(split.here.length === 0 && split.elsewhere.length > 0);

	function close() {
		asking = false;
		run += 1;
		uploading = false;
		onclose();
	}

	/** Upload what this phone holds, then send the move. */
	async function submit() {
		const { here, elsewhere } = split;
		const mine = ++run;
		if (here.length > 0) {
			uploading = true;
			refused = null;
			landed = [];
			for (const v of here) {
				const out = await landOriginal({ table: v.table, id: v.id, file: v.file });
				// Closed meanwhile: the uploads go on, the lesson stays.
				if (mine !== run) return;
				if (!out.ok) {
					uploading = false;
					refused = out.reason ?? t().video.place.uploadFailed;
					return;
				}
				landed = [...landed, v.id];
			}
			uploading = false;
		}
		without = elsewhere.length > 0 ? '1' : '';
		await tick();
		form?.requestSubmit();
	}

	/** Move: through the twins questions first, when there are any. */
	function go() {
		if (preview && preview.twins.length > 0) {
			step = 0;
			asking = true;
			return;
		}
		void submit();
	}

	async function next() {
		if (!preview) return;
		if (step < preview.twins.length - 1) {
			step += 1;
			return;
		}
		asking = false;
		await tick();
		void submit();
	}

	const NOTE =
		'flex items-start gap-3 rounded-2xl bg-step p-3.5 text-[14px] leading-[1.4] text-ink-2';
</script>

<Sheet title={moveTitle(offer.title, target.place)} sub={moveSub()} {open} onclose={close} tall>
	<div class="flex flex-col gap-3">
		{#if refused}<Banner kind="error">{refused}</Banner>{/if}
		{#if split.elsewhere.length > 0}
			<!-- On another device: no file here or on the server, so it can only stay behind. -->
			<div class="rounded-2xl bg-warn-soft px-4 py-3.5" role="status" data-stay-behind>
				<div class="flex items-center gap-2 text-[16px] font-extrabold text-warn">
					<Icon name="phone" size={18} />{pw.elsewhere(split.elsewhere.length, split.label)}
				</div>
				<p class="mt-1.5 text-[13.5px] font-medium text-ink-2">
					{pw.elsewhereBody(split.elsewhere.length)}
				</p>
			</div>
		{/if}
		{#if split.here.length > 0}
			<section class="flex flex-col gap-1.5" data-upload-first>
				<h3 class={SECTION_LABEL}>{pw.here}</h3>
				<ul class={GROUP}>
					{#each split.here as v (v.id)}
						{@const pct = uploadOf(v.file)}
						<li class="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
							<span
								class="grid h-10 w-16 flex-none place-items-center rounded-lg bg-black text-white"
								><Icon name="play" size={16} filled /></span
							>
							<span class="flex min-w-0 flex-1 flex-col gap-1">
								<span class="flex items-baseline gap-2">
									<span class="min-w-0 flex-1 text-[16px] font-bold text-ink"
										>{pw.name(numberOf(v.id))}</span
									>
									{#if pct !== null}<span class="text-[13px] font-extrabold text-accent-text"
											>{pct} %</span
										>{/if}
								</span>
								{#if landed.includes(v.id)}
									<span class="flex items-center gap-1 text-[13px] font-bold text-done"
										><Icon name="check" size={14} />{pw.landed}</span
									>
								{:else if pct !== null}
									<span class="block h-1 overflow-hidden rounded-full bg-track" aria-hidden="true"
										><span class="block h-full bg-accent" style="width: {pct}%"></span></span
									>
								{:else}
									<span class="flex items-center gap-1 text-[13px] font-medium text-muted"
										><Icon name="phone" size={14} />{pw.onlyHere(
											byteSize(v.originBytes ?? v.sizeBytes)
										)}</span
									>
								{/if}
							</span>
						</li>
					{/each}
				</ul>
				{#if uploading}
					<p class="px-1 text-[13px] font-medium text-muted">{pw.after(split.here.length)}</p>
				{/if}
			</section>
		{/if}
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
			<div class="flex flex-col gap-3 {uploading ? 'pointer-events-none opacity-60' : ''}">
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
						<span class="min-w-0 flex-1">{moveNote()}</span>
					</p>
					{#if practiceStays}
						<p class={NOTE}>
							<span class="mt-px flex-none text-muted"><Icon name="info" size={20} /></span>
							<span class="min-w-0 flex-1">{practiceStaysLine()}</span>
						</p>
					{/if}
				{:else}
					<p class={NOTE}>{preview.goes}</p>
				{/if}
			</div>
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
							refused = typeof data?.message === 'string' ? data.message : moveFailed();
						} else if (result.type === 'error') {
							refused = moveFailed();
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
			<input type="hidden" name="without" value={without} />
			<button type="button" class={button('tertiary', 'md', true)} onclick={close}
				>{cancelLabel()}</button
			>
			<button
				type="button"
				class={button(onlyWithout ? 'secondary' : 'primary', 'md', true)}
				disabled={busy || uploading || !preview}
				aria-busy={busy || uploading}
				onclick={go}
			>
				{#if uploading}
					{pw.uploading}
				{:else if busy}
					<Spinner />
				{:else if split.here.length > 0}
					<Icon name="cloud-up" size={20} />{pw.button}
				{:else if onlyWithout}
					{pw.without(split.elsewhere.length)}
				{:else}
					<Icon name="move-to" size={20} />{moveButton()}
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
				<span class="min-w-0 flex-1">{twinsOneGoes()}</span>
			</p>
		</div>
		{#snippet footer()}
			<button type="button" class={button('primary', 'md', true)} disabled={busy} onclick={next}
				>{continueLabel()}</button
			>
		{/snippet}
	</Sheet>
{/if}
